"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  EXPORT_LABELS,
  buildExport,
  copyText,
  downloadBlob,
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

  function flash(text: string, error = false) {
    setNotice({ text, error });
    window.setTimeout(() => setNotice(null), 2000);
  }

  async function handleCopy() {
    const ok = await copyText(toTxt(transcript));
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
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted-fg">
        Export
      </span>
      {FORMATS.map((format) => (
        <Button
          key={format}
          variant="secondary"
          size="sm"
          onClick={() => handleExport(format)}
        >
          {EXPORT_LABELS[format]}
        </Button>
      ))}
      <Button variant="secondary" size="sm" onClick={handleCopy}>
        Copy
      </Button>
      <Button variant="ghost" size="sm" onClick={handleSelectAll}>
        Select all
      </Button>
      {notice && (
        <span
          role={notice.error ? "alert" : "status"}
          className={notice.error ? "text-sm text-error" : "text-sm text-success"}
        >
          {notice.text}
        </span>
      )}
    </div>
  );
}
