"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { diffLines, diffStats, type DiffLine } from "@/lib/compare";
import { parseImport } from "@/lib/importers";
import type { Transcript } from "@/types";

/** Renders at most this many diff rows; huge documents truncate with a note. */
const MAX_ROWS = 1000;

interface CompareDialogProps {
  transcript: Transcript;
  onClose: () => void;
}

/** Line-diff of the current transcript against an imported TXT/SRT/VTT/MD file. */
export function CompareDialog({ transcript, onClose }: CompareDialogProps) {
  const [lines, setLines] = useState<DiffLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  async function handleFile(file: File) {
    setError(null);
    try {
      const text = await file.text();
      const other = parseImport(file.name, text);
      setLines(
        diffLines(
          transcript.segments.map((segment) => segment.text),
          other.segments.map((segment) => segment.text),
        ),
      );
    } catch (cause) {
      setLines(null);
      setError(cause instanceof Error ? cause.message : "That file could not be read.");
    }
  }

  const stats = lines ? diffStats(lines) : null;
  const shown = lines ? lines.slice(0, MAX_ROWS) : [];
  const hidden = lines ? lines.length - shown.length : 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-dialog-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        className="card flex w-full max-w-2xl flex-col gap-4 focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="compare-dialog-title" className="text-body font-semibold">
            Compare with a file
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <p className="text-body-sm text-muted-fg">
          Pick a TXT, SRT, VTT or Markdown file to see how it differs from this transcript —
          removed lines are marked red, added lines green.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".txt,.srt,.vtt,.md,.markdown,text/plain"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleFile(file);
          }}
        />
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            {lines ? "Choose another file" : "Choose file"}
          </Button>
          {stats && (
            <span className="text-caption text-muted-fg" aria-live="polite">
              {stats.same} unchanged · {stats.removed} removed · {stats.added} added
            </span>
          )}
        </div>

        {error && (
          <p role="alert" className="text-body-sm text-error">
            {error}
          </p>
        )}

        {lines && (
          <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border">
            {shown.length === 0 ? (
              <p className="px-3 py-4 text-body-sm text-muted-fg">
                Both transcripts have no text lines to compare.
              </p>
            ) : (
              <ol className="font-mono text-caption">
                {shown.map((line, index) => (
                  <li
                    key={index}
                    className={`whitespace-pre-wrap break-words px-3 py-1 ${
                      line.kind === "removed"
                        ? "bg-error/10 text-error"
                        : line.kind === "added"
                          ? "bg-primary/10 text-primary"
                          : "text-muted-fg"
                    }`}
                  >
                    <span aria-hidden="true" className="mr-2 inline-block w-3 select-none">
                      {line.kind === "removed" ? "−" : line.kind === "added" ? "+" : " "}
                    </span>
                    {line.text}
                  </li>
                ))}
              </ol>
            )}
            {hidden > 0 && (
              <p className="border-t border-border px-3 py-2 text-caption text-muted-fg">
                … {hidden} more lines not shown.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
