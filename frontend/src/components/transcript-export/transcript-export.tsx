"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  EXPORT_LABELS,
  buildExport,
  copyText,
  downloadBlob,
  toPlainText,
  toTxt,
  type ExportFormat,
} from "@/lib/export";
import type { Transcript } from "@/types";

const FORMATS: ExportFormat[] = ["txt", "srt", "vtt", "md", "pdf"];

interface TranscriptExportProps {
  transcript: Transcript;
  title?: string | null;
}

export function TranscriptExport({ transcript, title }: TranscriptExportProps) {
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // The menu closes on outside click and on Escape (DESIGN_SYSTEM.md §G).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function flash(text: string, error = false) {
    setNotice({ text, error });
    window.setTimeout(() => setNotice(null), 4000);
  }

  async function handleCopy(withTimestamps: boolean) {
    const ok = await copyText(withTimestamps ? toTxt(transcript) : toPlainText(transcript));
    flash(ok ? "Copied to clipboard." : "Could not access the clipboard.", !ok);
  }

  function handleExport(format: ExportFormat) {
    const { blob, filename } = buildExport(format, transcript, title);
    downloadBlob(blob, filename);
    flash(`Downloaded ${filename}`);
  }

  function handleSelectAll() {
    const node = document.getElementById("transcript-content");
    if (!node) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  return (
    <>
      <div ref={rootRef} className="relative">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          Export
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </Button>

        {open && (
          <div
            role="menu"
            aria-label="Export transcript"
            className="absolute right-0 top-full z-20 mt-2 w-52 animate-fade-in rounded-xl border border-border bg-background p-1.5 shadow-lg"
          >
            {FORMATS.map((format) => (
              <button
                key={format}
                role="menuitem"
                type="button"
                onClick={() => {
                  handleExport(format);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-md px-3 py-3 sm:py-2 text-caption transition-colors duration-150 hover:bg-surface"
              >
                {EXPORT_LABELS[format]}
                <span className="text-muted-fg">Download</span>
              </button>
            ))}
            <div className="my-1 border-t border-border" />
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                handleCopy(true);
                setOpen(false);
              }}
              className="w-full rounded-md px-3 py-3 sm:py-2 text-left text-caption transition-colors duration-150 hover:bg-surface"
            >
              Copy with timestamps
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                handleCopy(false);
                setOpen(false);
              }}
              className="w-full rounded-md px-3 py-3 sm:py-2 text-left text-caption transition-colors duration-150 hover:bg-surface"
            >
              Copy without timestamps
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                handleSelectAll();
                setOpen(false);
              }}
              className="w-full rounded-md px-3 py-3 sm:py-2 text-left text-caption transition-colors duration-150 hover:bg-surface"
            >
              Select all
            </button>
          </div>
        )}
      </div>

      {notice && (
        <div
          role={notice.error ? "alert" : "status"}
          className={`fixed bottom-6 right-6 z-30 max-w-[calc(100vw-3rem)] animate-fade-in rounded-full border border-border bg-background px-4 py-2 text-caption shadow-md ${
            notice.error ? "text-error" : "text-foreground"
          }`}
        >
          {notice.text}
        </div>
      )}
    </>
  );
}
