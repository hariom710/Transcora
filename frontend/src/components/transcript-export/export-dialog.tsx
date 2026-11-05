"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  DEFAULT_EXPORT_OPTIONS,
  EXPORT_FORMATS,
  EXPORT_LABELS,
  buildExport,
  defaultExportName,
  downloadBlob,
  filterSegments,
  type ExportFormat,
  type ExportOptions,
} from "@/lib/export";
import type { Transcript } from "@/types";

// Which options each format honours — SRT/VTT are fixed by their specs and
// PDF already writes its own title/language header.
const TIMESTAMPS_FORMATS: ExportFormat[] = ["txt", "md", "csv", "docx"];
const METADATA_FORMATS: ExportFormat[] = ["txt", "csv", "docx"];
const FORMATTING_FORMATS: ExportFormat[] = ["txt", "docx"];

interface ExportDialogProps {
  format: ExportFormat;
  transcript: Transcript;
  title?: string | null;
  /** Segment ids of current search matches — enables the "search results" scope. */
  matchIds: readonly number[];
  onClose: () => void;
  onExported: (text: string, error?: boolean) => void;
}

export function ExportDialog({
  format,
  transcript,
  title,
  matchIds,
  onClose,
  onExported,
}: ExportDialogProps) {
  const [selected, setSelected] = useState<ExportFormat>(format);
  const [opts, setOpts] = useState<ExportOptions>({
    ...DEFAULT_EXPORT_OPTIONS,
    filename: defaultExportName(transcript, title),
  });
  const [scope, setScope] = useState<"all" | "matches">("all");
  const [busy, setBusy] = useState(false);
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

  const hasMatches = matchIds.length > 0;
  const showTimestamps = TIMESTAMPS_FORMATS.includes(selected);
  const showMetadata = METADATA_FORMATS.includes(selected);
  const showFormatting = FORMATTING_FORMATS.includes(selected);

  async function handleExport() {
    setBusy(true);
    try {
      const source = scope === "matches" ? filterSegments(transcript, matchIds) : transcript;
      const { blob, filename } = await buildExport(selected, source, title, opts);
      downloadBlob(blob, filename);
      onExported(`Downloaded ${filename}`);
      onClose();
    } catch (cause) {
      console.error(cause);
      onExported("Export failed. Please try again.", true);
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        className="card flex w-full max-w-md flex-col gap-4 p-5 shadow-lg focus:outline-none"
      >
        <h2 id="export-dialog-title" className="text-body font-semibold">
          Export options
        </h2>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Format">
          {EXPORT_FORMATS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSelected(item)}
              aria-pressed={selected === item}
              className={cn(
                "h-9 rounded-full border px-3 text-caption transition-colors duration-150",
                selected === item
                  ? "border-primary bg-primary text-primary-fg"
                  : "border-border bg-background text-foreground hover:bg-surface",
              )}
            >
              {EXPORT_LABELS[item]}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-3 text-body-sm">
          Filename
          <Input
            value={opts.filename}
            onChange={(event) => setOpts({ ...opts, filename: event.target.value })}
            aria-label="Filename"
            className="h-10 min-w-0 flex-1"
          />
          <span className="text-caption text-muted-fg">.{selected}</span>
        </label>

        <div className="flex flex-col gap-2.5">
          {showTimestamps && (
            <label className="flex cursor-pointer items-center gap-2.5 text-body-sm">
              <input
                type="checkbox"
                checked={opts.timestamps}
                onChange={(event) => setOpts({ ...opts, timestamps: event.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              Include timestamps
            </label>
          )}
          {showMetadata && (
            <label className="flex cursor-pointer items-center gap-2.5 text-body-sm">
              <input
                type="checkbox"
                checked={opts.metadata}
                onChange={(event) => setOpts({ ...opts, metadata: event.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              Include metadata header (title, language, source)
            </label>
          )}

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-caption text-muted-fg">Scope</legend>
            <label className="flex cursor-pointer items-center gap-2.5 text-body-sm">
              <input
                type="radio"
                name="export-scope"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className="h-4 w-4 accent-primary"
              />
              Entire transcript
            </label>
            <label className={cn("flex items-center gap-2.5 text-body-sm", !hasMatches && "opacity-50")}>
              <input
                type="radio"
                name="export-scope"
                checked={scope === "matches"}
                disabled={!hasMatches}
                onChange={() => setScope("matches")}
                className="h-4 w-4 accent-primary"
              />
              Search results ({matchIds.length})
            </label>
          </fieldset>

          {showFormatting && (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-caption text-muted-fg">Formatting</legend>
              <label className="flex cursor-pointer items-center gap-2.5 text-body-sm">
                <input
                  type="radio"
                  name="export-formatting"
                  checked={opts.formatting === "segments"}
                  onChange={() => setOpts({ ...opts, formatting: "segments" })}
                  className="h-4 w-4 accent-primary"
                />
                One block per segment
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 text-body-sm">
                <input
                  type="radio"
                  name="export-formatting"
                  checked={opts.formatting === "paragraphs"}
                  onChange={() => setOpts({ ...opts, formatting: "paragraphs" })}
                  className="h-4 w-4 accent-primary"
                />
                Group into paragraphs
              </label>
            </fieldset>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void handleExport()} disabled={busy}>
            {busy ? "Exporting…" : "Export"}
          </Button>
        </div>
      </div>
    </div>
  );
}
