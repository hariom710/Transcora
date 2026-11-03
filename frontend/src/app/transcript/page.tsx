"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useSearchParams } from "next/navigation";

import { TranscriptExport } from "@/components/transcript-export/transcript-export";
import { TranscriptSearch } from "@/components/transcript-search/transcript-search";
import { TranscriptViewer } from "@/components/transcript-viewer/transcript-viewer";
import { VideoPlayer, type PlayerCommand } from "@/components/video-player/video-player";
import { VideoPreview } from "@/components/video-preview/video-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FONT_SIZES, useFontSize } from "@/hooks/use-font-size";
import { findActiveSegment } from "@/lib/playback";
import { findMatches } from "@/lib/search";
import { parseVideoId } from "@/lib/url";
import { ApiFailure, extractTranscript, inspectVideo, listLanguages } from "@/services/api";
import type { LanguageInfo, Transcript, TranscriptSegment, Video } from "@/types";

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

  // Player state: follow-playback sync, duration from the IFrame API, fallback.
  const [playbackId, setPlaybackId] = useState<number | null>(null);
  const [playerDuration, setPlayerDuration] = useState<number | null>(null);
  const [playerFailed, setPlayerFailed] = useState(false);
  const [command, setCommand] = useState<PlayerCommand | null>(null);
  const commandId = useRef(0);
  const timeRef = useRef(0);
  const segmentsRef = useRef<readonly TranscriptSegment[]>([]);

  // Workspace state: search focus, pane split, fullscreen.
  const searchRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const panesRef = useRef<HTMLDivElement>(null);
  const { scale: fontScale, change: changeFont } = useFontSize();
  const [split, setSplit] = useState(55);
  const [fullscreen, setFullscreen] = useState(false);

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

  // Keep the ref current so the playback callback stays stable.
  useEffect(() => {
    segmentsRef.current = current?.segments ?? [];
  });

  const handleTime = useCallback((seconds: number) => {
    timeRef.current = seconds;
    // Same id → React bails out; a re-render happens only when the active
    // segment actually changes, so long transcripts stay cheap.
    setPlaybackId(findActiveSegment(segmentsRef.current, seconds));
  }, []);

  const sendToggle = useCallback(() => {
    commandId.current += 1;
    setCommand({ id: commandId.current, action: "toggle" });
  }, []);

  const seekTo = useCallback((time: number) => {
    commandId.current += 1;
    setCommand({ id: commandId.current, action: "seek", time: Math.max(0, time) });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void workspaceRef.current?.requestFullscreen().catch(() => undefined);
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    const row = panesRef.current;
    if (!row) return;
    event.preventDefault();
    const move = (moveEvent: PointerEvent) => {
      const rect = row.getBoundingClientRect();
      const percent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setSplit(Math.min(75, Math.max(25, percent)));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  // Workspace shortcuts: "/" search, k play/pause, j/l seek, f fullscreen.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable)
        return;
      switch (event.key) {
        case "/":
          event.preventDefault();
          searchRef.current?.focus();
          break;
        case "k":
          sendToggle();
          break;
        case "j":
          seekTo(timeRef.current - 10);
          break;
        case "l":
          seekTo(timeRef.current + 10);
          break;
        case "f":
          toggleFullscreen();
          break;
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sendToggle, seekTo, toggleFullscreen]);

  const safeIndex = matches.length > 0 ? activeMatch % matches.length : 0;
  // A search match wins while a query is active; otherwise follow playback.
  const activeSegmentId = matches[safeIndex]?.segmentId ?? playbackId;

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
        <div className="card max-w-xl p-5" role="alert">
          <h1 className="text-body font-semibold">Transcript unavailable</h1>
          <p className="mt-1 text-body-sm text-muted-fg">
            That doesn&apos;t look like a supported YouTube video URL.
          </p>
        </div>
        <Button variant="secondary" onClick={() => window.history.back()}>
          Go back
        </Button>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
        <div className="card h-24 w-full animate-pulse" />
        <p className="text-body-sm text-muted-fg">Fetching transcript…</p>
        <div className="card flex flex-col gap-4 p-5">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="h-5 w-full animate-pulse rounded-sm bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (phase === "error" || !current) {
    return (
      <div className="flex flex-col items-start gap-4">
        <div className="card max-w-xl p-5">
          <h1 className="text-body font-semibold">Transcript unavailable</h1>
          <p className="mt-1 text-body-sm text-muted-fg">{error || "No transcript was returned."}</p>
          <p className="mt-2 text-body-sm text-muted-fg">
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
    <div ref={workspaceRef} className="workspace flex flex-col gap-5">
      {/* Toolbar: title, caption type, search, language, text size, fullscreen.
          Stacked below lg so the search field keeps a usable width on tablets. */}
      <div className="card flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-3 lg:shrink-0">
          <h1 className="text-body font-semibold">Transcript</h1>
          <Badge>{current.is_generated ? "Auto-generated" : "Manual captions"}</Badge>
        </div>
        <TranscriptSearch
          inputRef={searchRef}
          query={query}
          onQueryChange={handleQueryChange}
          matchCount={matches.length}
          activeMatch={matches.length ? safeIndex + 1 : 0}
          onPrevious={() => setActiveMatch((value) => value - 1)}
          onNext={() => setActiveMatch((value) => value + 1)}
        />
        <label className="flex shrink-0 items-center gap-2 text-caption text-muted-fg">
          Language
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="h-11 rounded-md border border-border bg-background px-2 text-caption text-foreground sm:h-9"
          >
            <option value="">Default</option>
            {languages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => changeFont(-1)}
            disabled={fontScale === 0}
            aria-label="Smaller transcript text"
            title="Smaller text"
          >
            A−
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => changeFont(1)}
            disabled={fontScale === FONT_SIZES.length - 1}
            aria-label="Larger transcript text"
            title="Larger text"
          >
            A+
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title="Fullscreen (F)"
          >
            {fullscreen ? <ExitFullscreenIcon /> : <EnterFullscreenIcon />}
          </Button>
        </div>
      </div>

      {/* Two panes: sticky video | resizable divider | transcript. */}
      <div
        ref={panesRef}
        style={{ "--split": `${split}%` } as CSSProperties}
        className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-3"
      >
        <section className="flex w-full min-w-0 flex-col gap-4 lg:sticky lg:top-16 lg:w-[var(--split)] lg:shrink-0">
          {playerFailed ? (
            <VideoPreview video={video} />
          ) : (
            <>
              <VideoPlayer
                videoId={videoId}
                command={command}
                onTime={handleTime}
                onDuration={setPlayerDuration}
                onError={() => setPlayerFailed(true)}
              />
              <VideoPreview
                video={video ? { ...video, duration: playerDuration ?? video.duration } : null}
              />
            </>
          )}
        </section>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize video and transcript panes"
          tabIndex={0}
          onPointerDown={startResize}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") setSplit((value) => Math.max(25, value - 2));
            if (event.key === "ArrowRight") setSplit((value) => Math.min(75, value + 2));
          }}
          className="hidden w-1 shrink-0 cursor-col-resize self-stretch rounded-full bg-border transition-colors duration-150 hover:bg-primary lg:block"
        />

        <section className="flex min-w-0 flex-1 flex-col gap-4">
          {current.segments.length === 0 ? (
            <p className="card p-5 text-body-sm text-muted-fg">
              This video has no caption text available.
            </p>
          ) : (
            <TranscriptViewer
              segments={current.segments}
              videoId={videoId}
              query={query}
              activeSegmentId={activeSegmentId}
              onEdit={handleEdit}
              onSeek={playerFailed ? undefined : seekTo}
              sizeClass={FONT_SIZES[fontScale]}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            {stats && (
              <p className="text-caption text-muted-fg" aria-live="polite">
                {stats.segments} segments · {stats.words} words · {stats.characters} characters ·{" "}
                {current.language}
              </p>
            )}
            <TranscriptExport transcript={current} title={video?.title} />
          </div>
        </section>
      </div>
    </div>
  );
}

function EnterFullscreenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
    </svg>
  );
}
