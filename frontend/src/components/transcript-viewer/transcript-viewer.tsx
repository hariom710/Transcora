"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { highlightParts } from "@/lib/search";
import { formatClock } from "@/lib/timestamp";
import type { TranscriptSegment } from "@/types";

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  videoId: string;
  query: string;
  activeSegmentId: number | null;
  onEdit: (id: number, text: string) => void;
}

export function TranscriptViewer({
  segments,
  videoId,
  query,
  activeSegmentId,
  onEdit,
}: TranscriptViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (activeSegmentId == null) return;
    const node = containerRef.current?.querySelector(`[data-segment="${activeSegmentId}"]`);
    if (!node) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
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

  return (
    <div id="transcript-content" ref={containerRef} className="card divide-y divide-border">
      {segments.map((segment) => {
        const editing = editingId === segment.id;
        const parts = highlightParts(segment.text, query);

        return (
          <article
            key={segment.id}
            data-segment={segment.id}
            className="group relative flex gap-3 px-4 py-3 transition-colors duration-150 hover:bg-background/60 sm:px-5"
          >
            <a
              href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(segment.start)}s`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-14 shrink-0 pt-0.5 font-mono text-caption tabular-nums text-muted-fg transition-colors duration-150 hover:text-primary"
              title="Open video at this timestamp"
            >
              {formatClock(segment.start)}
            </a>

            <div className="min-w-0 flex-1">
              {editing ? (
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={() => commitEdit(segment.id)}
                  onKeyDown={(event) => handleEditKeys(event, segment.id)}
                  rows={Math.min(6, Math.ceil(draft.length / 60))}
                  autoFocus
                  aria-label="Edit transcript segment"
                  className="w-full resize-y rounded-md border border-border bg-background p-2 font-mono text-body-sm"
                />
              ) : (
                <p
                  onDoubleClick={() => startEdit(segment)}
                  className="whitespace-pre-wrap text-body-sm"
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
            </div>

            <div className="flex shrink-0 gap-1 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
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
