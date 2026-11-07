"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/cn";
import { highlightParts } from "@/lib/search";
import { formatClock } from "@/lib/timestamp";
import type { TranscriptSegment } from "@/types";

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  videoId: string;
  query: string;
  activeSegmentId: number | null;
  onEdit: (id: number, text: string) => void;
  /** Seeks the embedded player; when absent the timestamp opens YouTube instead. */
  onSeek?: (seconds: number) => void;
  /** Font-size class chosen by the toolbar (font-size controls). */
  sizeClass: string;
  /** Annotations: highlight tints, bookmark stars, per-segment notes. */
  highlights: ReadonlySet<number>;
  bookmarks: ReadonlySet<number>;
  notes: Record<number, string>;
  onToggleHighlight: (id: number) => void;
  onToggleBookmark: (id: number) => void;
  onNote: (id: number, text: string) => void;
}

export function TranscriptViewer({
  segments,
  videoId,
  query,
  activeSegmentId,
  onEdit,
  onSeek,
  sizeClass,
  highlights,
  bookmarks,
  notes,
  onToggleHighlight,
  onToggleBookmark,
  onNote,
}: TranscriptViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [noteId, setNoteId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    if (activeSegmentId == null) return;
    const node = containerRef.current?.querySelector(`[data-segment="${activeSegmentId}"]`);
    if (!node) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // "nearest" scrolls only when the row is off-screen, so playback follow
    // does not fight the reader's scroll position.
    node.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [activeSegmentId]);

  function startEdit(segment: TranscriptSegment) {
    setEditingId(segment.id);
    setDraft(segment.text);
  }

  function commitEdit(id: number) {
    const text = draft.trim();
    if (text) onEdit(id, text);
    setEditingId(null);
  }

  function handleEditKeys(event: KeyboardEvent<HTMLTextAreaElement>, id: number) {
    if (event.key === "Escape") {
      event.preventDefault();
      setEditingId(null);
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      commitEdit(id);
    }
  }

  function startNote(segment: TranscriptSegment) {
    setNoteId(segment.id);
    setNoteDraft(notes[segment.id] ?? "");
  }

  function commitNote(id: number) {
    onNote(id, noteDraft.trim());
    setNoteId(null);
  }

  function handleNoteKeys(event: KeyboardEvent<HTMLTextAreaElement>, id: number) {
    if (event.key === "Escape") {
      event.preventDefault();
      setNoteId(null);
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      commitNote(id);
    }
  }

  return (
    <div id="transcript-content" ref={containerRef} className="card divide-y divide-border">
      {segments.map((segment) => {
        const editing = editingId === segment.id;
        const parts = highlightParts(segment.text, query);
        const highlighted = highlights.has(segment.id);
        const bookmarked = bookmarks.has(segment.id);
        const note = notes[segment.id];
        const annotating = noteId === segment.id;

        return (
          <article
            key={segment.id}
            data-segment={segment.id}
            className={cn(
              "group relative flex flex-wrap gap-3 px-4 py-3 transition-colors duration-150 hover:bg-background/60 sm:px-5",
              segment.id === activeSegmentId && "bg-primary/5",
              highlighted && !editing && "bg-accent/15",
            )}
          >
            <a
              href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(segment.start)}s`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                if (!onSeek) return;
                event.preventDefault();
                onSeek(segment.start);
              }}
              className={cn(
                "w-14 shrink-0 pt-0.5 font-mono text-caption tabular-nums transition-colors duration-150 hover:text-primary",
                segment.id === activeSegmentId ? "text-primary" : "text-muted-fg",
              )}
              title={onSeek ? "Play from this timestamp" : "Open video at this timestamp"}
            >
              {formatClock(segment.start)}
              {bookmarked && (
                <span className="ml-1 text-primary" title="Bookmarked" aria-label="Bookmarked">
                  ★
                </span>
              )}
            </a>

            {/* basis-72 makes the action row wrap under the text on narrow
                screens so five buttons never squeeze the transcript. */}
            <div className="min-w-0 flex-1 basis-72">
              {editing ? (
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={() => commitEdit(segment.id)}
                  onKeyDown={(event) => handleEditKeys(event, segment.id)}
                  rows={Math.min(6, Math.ceil(draft.length / 60))}
                  autoFocus
                  aria-label="Edit transcript segment"
                  className={cn(
                    "w-full resize-y rounded-md border border-border bg-background p-2 font-mono",
                    sizeClass,
                  )}
                />
              ) : (
                <p
                  onDoubleClick={() => startEdit(segment)}
                  className={cn("whitespace-pre-wrap", sizeClass)}
                >
                  {parts.map((part, index) =>
                    part.hit ? (
                      <mark
                        key={index}
                        className="rounded-sm bg-accent/20 px-0.5 text-inherit"
                      >
                        {part.text}
                      </mark>
                    ) : (
                      <span key={index}>{part.text}</span>
                    ),
                  )}
                </p>
              )}

              {annotating ? (
                <textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  onBlur={() => commitNote(segment.id)}
                  onKeyDown={(event) => handleNoteKeys(event, segment.id)}
                  rows={2}
                  autoFocus
                  placeholder="Note (empty removes it) — Enter to save, Esc to cancel"
                  aria-label={`Note for segment ${segment.id}`}
                  className="mt-1.5 w-full resize-y rounded-md border border-border bg-background p-2 text-caption"
                />
              ) : (
                note && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-caption text-muted-fg">
                    <span className="shrink-0 pt-0.5" aria-hidden="true">
                      <NoteIcon />
                    </span>
                    {/* pre-wrap keeps multiline notes as authored (T3 audit D6). */}
                    <span className="whitespace-pre-wrap">{note}</span>
                  </p>
                )
              )}
            </div>

            <div className="ml-auto flex shrink-0 gap-1 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(segment.text)}
                aria-label={`Copy segment ${segment.id}`}
                className="h-11 w-11 rounded-md text-muted-fg hover:bg-surface hover:text-foreground sm:h-auto sm:w-auto sm:p-1.5"
              >
                <CopyIcon />
              </button>
              <button
                type="button"
                onClick={() => startEdit(segment)}
                aria-label={`Edit segment ${segment.id}`}
                className="h-11 w-11 rounded-md text-muted-fg hover:bg-surface hover:text-foreground sm:h-auto sm:w-auto sm:p-1.5"
              >
                <EditIcon />
              </button>
              <button
                type="button"
                onClick={() => onToggleHighlight(segment.id)}
                aria-label={`Highlight segment ${segment.id}`}
                aria-pressed={highlighted}
                title="Highlight"
                className={cn(
                  "h-11 w-11 rounded-md hover:bg-surface sm:h-auto sm:w-auto sm:p-1.5",
                  highlighted ? "text-primary" : "text-muted-fg hover:text-foreground",
                )}
              >
                <HighlightIcon />
              </button>
              <button
                type="button"
                onClick={() => (annotating ? commitNote(segment.id) : startNote(segment))}
                aria-label={`Note for segment ${segment.id}`}
                aria-pressed={Boolean(note)}
                title="Add a note"
                className={cn(
                  "h-11 w-11 rounded-md hover:bg-surface sm:h-auto sm:w-auto sm:p-1.5",
                  note ? "text-primary" : "text-muted-fg hover:text-foreground",
                )}
              >
                <NoteIcon />
              </button>
              <button
                type="button"
                onClick={() => onToggleBookmark(segment.id)}
                aria-label={`Bookmark segment ${segment.id}`}
                aria-pressed={bookmarked}
                title="Bookmark"
                className={cn(
                  "h-11 w-11 rounded-md hover:bg-surface sm:h-auto sm:w-auto sm:p-1.5",
                  bookmarked ? "text-primary" : "text-muted-fg hover:text-foreground",
                )}
              >
                <StarIcon filled={bookmarked} />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function HighlightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 15l5-5 2 2-5 5h-4z" />
      <path d="M4 20h6l-3-3-3 3z" />
      <path d="M14 15l-7-7 5-5 7 7" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
