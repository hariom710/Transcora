"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { TranscriptExport } from "@/components/transcript-export/transcript-export";
import { TranscriptSearch } from "@/components/transcript-search/transcript-search";
import { TranscriptViewer } from "@/components/transcript-viewer/transcript-viewer";
import { VideoPreview } from "@/components/video-preview/video-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { findMatches } from "@/lib/search";
import { parseVideoId } from "@/lib/url";
import { ApiFailure, extractTranscript, inspectVideo, listLanguages } from "@/services/api";
import type { LanguageInfo, Transcript, Video } from "@/types";

export default function TranscriptPage() {
  return (
    <Suspense fallback={<p className="text-muted-fg">Loading…</p>}>
      <Workspace />
    </Suspense>
  );
}

interface LoadResult {
  key: string;
  transcript: Transcript | null;
  error: string;
}

function Workspace() {
  const params = useSearchParams();
  const url = params.get("url") ?? "";
  const videoId = parseVideoId(url);

  const [video, setVideo] = useState<Video | null>(null);
  const [languages, setLanguages] = useState<LanguageInfo[]>([]);
  const [language, setLanguage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);

  const [query, setQuery] = useState("");
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [activeMatch, setActiveMatch] = useState(0);

  // Identifies which request a stored result belongs to. Changing it returns the
  // UI to loading without calling setState synchronously inside the effect.
  const requestKey = `${url}|${language}|${attempt}`;

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    extractTranscript(url, language || undefined)
      .then((value) => {
        if (!cancelled) setResult({ key: requestKey, transcript: value, error: "" });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setResult({
          key: requestKey,
          transcript: null,
          error:
            cause instanceof ApiFailure
              ? cause.message
              : "Something went wrong. Please try again.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [url, videoId, language, attempt, requestKey]);

  const loaded = result !== null && result.key === requestKey ? result : null;
  const transcript = loaded?.transcript ?? null;
  const phase: "loading" | "ready" | "error" = !videoId
    ? "error"
    : loaded === null
      ? "loading"
      : loaded.transcript !== null
        ? "ready"
        : "error";
  const error = loaded?.error ?? "";

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    // Metadata and language lists are best effort — never block the transcript.
    inspectVideo(url)
      .then((result) => !cancelled && setVideo(result))
      .catch(() => undefined);
    listLanguages(videoId)
      .then((result) => !cancelled && setLanguages(result.languages))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [url, videoId]);

  const current = useMemo<Transcript | null>(() => {
    if (!transcript) return null;
    if (Object.keys(edits).length === 0) return transcript;
    return {
      ...transcript,
      segments: transcript.segments.map((segment) =>
        segment.id in edits ? { ...segment, text: edits[segment.id] } : segment,
      ),
    };
  }, [transcript, edits]);

  const matches = useMemo(() => {
    if (!query || !current) return [] as Array<{ segmentId: number }>;
    const list: Array<{ segmentId: number }> = [];
    for (const segment of current.segments) {
      if (findMatches(segment.text, query).length > 0) list.push({ segmentId: segment.id });
    }
    return list;
  }, [query, current]);

  const safeIndex = matches.length > 0 ? activeMatch % matches.length : 0;
  const activeSegmentId = matches[safeIndex]?.segmentId ?? null;

  const stats = useMemo(() => {
    if (!current) return null;
    let words = 0;
    let characters = 0;
    for (const segment of current.segments) {
      characters += segment.text.length;
      const trimmed = segment.text.trim();
      if (trimmed) words += trimmed.split(/\s+/).length;
    }
    return { segments: current.segments.length, words, characters };
  }, [current]);

  const handleEdit = useCallback((id: number, text: string) => {
    setEdits((previous) => ({ ...previous, [id]: text }));
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    setActiveMatch(0);
  }

  if (!videoId) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p role="alert" className="text-error">
          That doesn&apos;t look like a supported YouTube video URL.
        </p>
        <Button variant="secondary" onClick={() => window.history.back()}>
          Go back
        </Button>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
        <div className="h-24 w-full animate-pulse rounded-md bg-muted" />
        <p className="text-sm text-muted-fg">Fetching transcript…</p>
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="h-6 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (phase === "error" || !current) {
    return (
      <div className="flex flex-col items-start gap-4">
        <div className="rounded-md border border-border bg-surface p-4">
          <h2 className="font-semibold">Transcript unavailable</h2>
          <p className="mt-1 text-sm text-muted-fg">{error || "No transcript was returned."}</p>
          <p className="mt-2 text-sm text-muted-fg">
            This tool extracts captions that already exist — it does not transcribe audio.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <VideoPreview video={video} />

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Transcript</h1>
        <Badge>{current.is_generated ? "Auto-generated" : "Manual captions"}</Badge>
        <label className="flex items-center gap-2 text-sm text-muted-fg">
          Language
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
          >
            <option value="">Default</option>
            {languages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <TranscriptSearch
          query={query}
          onQueryChange={handleQueryChange}
          matchCount={matches.length}
          activeMatch={matches.length ? safeIndex + 1 : 0}
          onPrevious={() => setActiveMatch((value) => value - 1)}
          onNext={() => setActiveMatch((value) => value + 1)}
        />
      </div>

      {current.segments.length === 0 ? (
        <p className="rounded-md border border-border bg-surface p-4 text-sm text-muted-fg">
          This video has no caption text available.
        </p>
      ) : (
        <TranscriptViewer
          segments={current.segments}
          videoId={videoId}
          query={query}
          activeSegmentId={activeSegmentId}
          onEdit={handleEdit}
        />
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <TranscriptExport transcript={current} title={video?.title} />
        {stats && (
          <p className="text-xs text-muted-fg" aria-live="polite">
            {stats.segments} segments · {stats.words} words · {stats.characters} characters ·{" "}
            {current.language}
          </p>
        )}
      </div>
    </div>
  );
}
