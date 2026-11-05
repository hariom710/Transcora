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
import { useEditHistory } from "@/hooks/use-edit-history";
import { FONT_SIZES, useFontSize } from "@/hooks/use-font-size";
import { cn } from "@/lib/cn";
import { findActiveSegment } from "@/lib/playback";
import {
  bulkTransform,
  cleanupText,
  readingMinutes,
  removeFillers,
  replaceAll,
  toggleId,
} from "@/lib/productivity";
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
  const [replacement, setReplacement] = useState("");
  const [activeMatch, setActiveMatch] = useState(0);

  // T3 productivity: undo/redo over edits, annotations, reading mode, tool toast.
  const { edits, canUndo, canRedo, patch, commit, undo, redo } = useEditHistory();
  const [highlights, setHighlights] = useState<ReadonlySet<number>>(new Set());
  const [bookmarks, setBookmarks] = useState<ReadonlySet<number>>(new Set());
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [readingMode, setReadingMode] = useState(false);
  const [toolNotice, setToolNotice] = useState<string | null>(null);
  const toolTimer = useRef<number>(0);

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

  // Workspace shortcuts: "/" search, k play/pause, j/l seek, f fullscreen,
  // r reading mode; Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const typing =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !typing) {
        const key = event.key.toLowerCase();
        if (key === "z") {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
          return;
        }
        if (key === "y") {
          event.preventDefault();
          redo();
          return;
        }
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (typing) return;
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
        case "r":
          setReadingMode((value) => !value);
          break;
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sendToggle, seekTo, toggleFullscreen, undo, redo]);

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

  const handleEdit = useCallback(
    (id: number, text: string) => {
      patch({ [id]: text });
    },
    [patch],
  );

  function flashTool(text: string) {
    setToolNotice(text);
    window.clearTimeout(toolTimer.current);
    toolTimer.current = window.setTimeout(() => setToolNotice(null), 3500);
  }

  function handleNote(id: number, text: string) {
    setNotes((previous) => {
      const next = { ...previous };
      if (text) next[id] = text;
      else delete next[id];
      return next;
    });
  }

  /** Bulk text tool: transforms every segment, one undo step for the lot. */
  function runTool(name: string, transform: (text: string) => string) {
    if (!current) return;
    const delta = bulkTransform(current.segments, transform);
    const count = Object.keys(delta).length;
    if (count === 0) {
      flashTool(`${name}: nothing to change.`);
      return;
    }
    commit({ ...edits, ...delta });
    flashTool(`${name}: ${count} segments updated (Ctrl+Z to undo).`);
  }

  function handleReplaceAll() {
    if (!current || !query) return;
    const delta = replaceAll(current.segments, query, replacement);
    const count = Object.keys(delta).length;
    if (count === 0) {
      flashTool("Replace: nothing to change.");
      return;
    }
    commit({ ...edits, ...delta });
    flashTool(`Replace: ${count} segments updated (Ctrl+Z to undo).`);
  }

  function jumpToSegment(segment: TranscriptSegment) {
    // Set first so the jump is visible instantly; the player seek confirms it.
    setPlaybackId(segment.id);
    seekTo(segment.start);
  }

  function jumpBookmark(direction: 1 | -1) {
    if (!current || bookmarks.size === 0) return;
    const list = current.segments.filter((segment) => bookmarks.has(segment.id));
    if (list.length === 0) return;
    const time = timeRef.current;
    const target =
      direction === 1
        ? list.find((segment) => segment.start > time + 0.5) ?? list[0]
        : ([...list].reverse().find((segment) => segment.start < time - 0.5) ??
          list[list.length - 1]);
    jumpToSegment(target);
  }

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
      {/* Toolbar: title, caption type, search, language, text size, fullscreen;
          a second row holds the T3 productivity tools. */}
      <div className="card flex flex-col gap-3 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
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
            replacement={replacement}
            onReplacementChange={setReplacement}
            onReplaceAll={handleReplaceAll}
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

        {/* T3 productivity row: undo/redo, text tools, reading mode, bookmarks. */}
        <div
          role="group"
          aria-label="Transcript tools"
          className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
          >
            ↷ Redo
          </Button>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => runTool("Remove fillers", (text) => cleanupText(removeFillers(text)))}
            title="Drop spoken fillers like um, uh, hmm"
          >
            Remove fillers
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => runTool("Clean up text", cleanupText)}
            title="Fix repeated spaces and space before punctuation"
          >
            Clean up text
          </Button>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setReadingMode((value) => !value)}
            aria-pressed={readingMode}
            title="Hide the video and read a single column (R)"
          >
            Reading mode
          </Button>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => jumpBookmark(-1)}
            disabled={bookmarks.size === 0}
            aria-label="Previous bookmark"
            title="Previous bookmark"
          >
            ‹★
          </Button>
          <span className="text-caption tabular-nums text-muted-fg" aria-live="polite">
            ★ {bookmarks.size}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => jumpBookmark(1)}
            disabled={bookmarks.size === 0}
            aria-label="Next bookmark"
            title="Next bookmark"
          >
            ★›
          </Button>
        </div>
      </div>

      {/* Two panes: sticky video | resizable divider | transcript. */}
      <div
        ref={panesRef}
        style={{ "--split": `${split}%` } as CSSProperties}
        className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-3"
      >
        {!readingMode && (
          <>
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
          </>
        )}

        <section
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-4",
            readingMode && "mx-auto w-full max-w-3xl",
          )}
        >
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
              highlights={highlights}
              bookmarks={bookmarks}
              notes={notes}
              onToggleHighlight={(id) => setHighlights((value) => toggleId(value, id))}
              onToggleBookmark={(id) => setBookmarks((value) => toggleId(value, id))}
              onNote={handleNote}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            {stats && (
              <p className="text-caption text-muted-fg" aria-live="polite">
                {stats.segments} segments · {stats.words} words · {stats.characters} characters ·{" "}
                {readingMinutes(stats.words)} min read · {current.language}
                {highlights.size > 0 && <> · {highlights.size} highlighted</>}
                {Object.keys(notes).length > 0 && <> · {Object.keys(notes).length} notes</>}
                {bookmarks.size > 0 && <> · ★ {bookmarks.size} bookmarked</>}
              </p>
            )}
            <TranscriptExport
              transcript={current}
              title={video?.title}
              matchIds={matches.map((match) => match.segmentId)}
            />
          </div>
        </section>
      </div>

      {toolNotice && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 max-w-[calc(100vw-3rem)] animate-fade-in rounded-full border border-border bg-background px-4 py-2 text-caption shadow-md"
        >
          {toolNotice}
        </div>
      )}
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
