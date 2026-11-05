import { Document, Packer, Paragraph, TextRun } from "docx";
import { jsPDF } from "jspdf";

import type { Transcript, TranscriptSegment } from "@/types";
import { formatClock, formatSrtTime, formatVttTime } from "./timestamp";

export type ExportFormat = "txt" | "srt" | "vtt" | "md" | "pdf" | "csv" | "docx";

export const EXPORT_LABELS: Record<ExportFormat, string> = {
  txt: "TXT",
  srt: "SRT",
  vtt: "VTT",
  md: "MD",
  pdf: "PDF",
  csv: "CSV",
  docx: "DOCX",
};

/** Menu and dialog order. */
export const EXPORT_FORMATS: ExportFormat[] = ["txt", "srt", "vtt", "md", "csv", "docx", "pdf"];

/** Options exposed in the export dialog. Defaults preserve the original output. */
export interface ExportOptions {
  /** Prefix each line/block with its clock timestamp (txt, md, csv, docx). */
  timestamps: boolean;
  /** Prepend a title/language/source header (txt, csv, docx). */
  metadata: boolean;
  /** One block per caption segment, or gap-grouped paragraphs (txt, docx). */
  formatting: "segments" | "paragraphs";
  /** Base filename without extension; empty falls back to title/video id. */
  filename: string;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  timestamps: true,
  metadata: false,
  formatting: "segments",
  filename: "",
};

/** Safe download base name, shared by the dialog prefill and buildExport. */
export function defaultExportName(t: Transcript, title?: string | null): string {
  return (title || t.video_id).replace(/[^\w\- ]+/g, "").trim() || "transcript";
}

/** Keeps only the given segment ids, preserving transcript order. */
export function filterSegments(t: Transcript, ids: readonly number[]): Transcript {
  const wanted = new Set(ids);
  return { ...t, segments: t.segments.filter((s) => wanted.has(s.id)) };
}

/**
 * Groups segments into paragraphs, breaking where the caption gap exceeds
 * 2s — captions split mid-sentence, gaps usually mark sentence transitions.
 */
export function toParagraphs(
  segments: readonly TranscriptSegment[],
  gapSeconds = 2,
): TranscriptSegment[][] {
  const groups: TranscriptSegment[][] = [];
  for (const segment of segments) {
    const last = groups[groups.length - 1];
    const previous = last?.[last.length - 1];
    if (!previous || segment.start - (previous.start + previous.duration) > gapSeconds) {
      groups.push([segment]);
    } else {
      last.push(segment);
    }
  }
  return groups;
}

function caption(t: Transcript): string {
  return t.is_generated ? `${t.language} (auto-generated)` : t.language;
}

function metadataPairs(t: Transcript, title?: string | null): Array<[string, string]> {
  return [
    ["Title", title || `Transcript — ${t.video_id}`],
    ["Language", caption(t)],
    ["Segments", String(t.segments.length)],
    ["Source", `https://www.youtube.com/watch?v=${t.video_id}`],
  ];
}

export function toTxt(t: Transcript, opts: ExportOptions = DEFAULT_EXPORT_OPTIONS): string {
  const stamp = (s: TranscriptSegment) => (opts.timestamps ? `${formatClock(s.start)} ` : "");
  if (opts.formatting === "paragraphs") {
    return toParagraphs(t.segments)
      .map((group) => group.map((s) => `${stamp(s)}${s.text}`).join(" "))
      .join("\n\n");
  }
  return t.segments.map((s) => `${stamp(s)}${s.text}`).join("\n");
}

/** Clipboard variant without clock prefixes — one paragraph-ish block of text. */
export function toPlainText(t: Transcript): string {
  return t.segments.map((s) => s.text).join("\n");
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(
  t: Transcript,
  opts: ExportOptions = DEFAULT_EXPORT_OPTIONS,
  title?: string | null,
): string {
  const rows: string[] = [];
  if (opts.metadata) {
    for (const [key, value] of metadataPairs(t, title)) {
      rows.push(`${csvCell(key)},${csvCell(value)}`);
    }
    rows.push("");
  }
  rows.push(opts.timestamps ? "timestamp,text" : "text");
  for (const s of t.segments) {
    rows.push(opts.timestamps ? `${csvCell(formatClock(s.start))},${csvCell(s.text)}` : csvCell(s.text));
  }
  // RFC 4180 line endings.
  return `${rows.join("\r\n")}\r\n`;
}

export async function toDocx(
  t: Transcript,
  opts: ExportOptions = DEFAULT_EXPORT_OPTIONS,
  title?: string | null,
): Promise<Blob> {
  const children: Paragraph[] = [];
  if (opts.metadata) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: defaultExportName(t, title), bold: true, size: 32 })],
      }),
    );
    for (const [key, value] of metadataPairs(t, title).slice(1)) {
      children.push(new Paragraph({ children: [new TextRun({ text: `${key}: ${value}`, size: 20 })] }));
    }
    children.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
  }
  const blocks: TranscriptSegment[][] =
    opts.formatting === "paragraphs"
      ? toParagraphs(t.segments)
      : t.segments.map((s) => [s]);
  for (const block of blocks) {
    const text = block.map((s) => s.text).join(" ");
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: opts.timestamps
          ? [
              new TextRun({ text: `${formatClock(block[0].start)} `, bold: true }),
              new TextRun({ text }),
            ]
          : [new TextRun({ text })],
      }),
    );
  }
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}

export function toSrt(t: Transcript): string {
  return (
    t.segments
      .map(
        (s, i) =>
          `${i + 1}\n${formatSrtTime(s.start)} --> ${formatSrtTime(s.start + s.duration)}\n${s.text}`,
      )
      .join("\n\n") + "\n"
  );
}

export function toVtt(t: Transcript): string {
  const cues = t.segments
    .map(
      (s) => `${formatVttTime(s.start)} --> ${formatVttTime(s.start + s.duration)}\n${s.text}`,
    )
    .join("\n\n");
  return `WEBVTT\n\n${cues}\n`;
}

export function toMarkdown(
  t: Transcript,
  title?: string | null,
  opts: ExportOptions = DEFAULT_EXPORT_OPTIONS,
): string {
  const heading = `# ${title || `Transcript — ${t.video_id}`}\n\n`;
  const meta = `_Language: ${caption(t)} · ${t.segments.length} segments_\n\n`;
  const body = t.segments
    .map((s) => (opts.timestamps ? `**${formatClock(s.start)}** ${s.text}` : s.text))
    .join("\n\n");
  return `${heading}${meta}${body}\n`;
}

export function toPdf(t: Transcript, title?: string | null): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  // shortcut: jsPDF base-14 fonts are Latin-1, so non-Latin transcripts render
  // as boxes; upgrade to an embedded Unicode font if that shows up in practice.
  const write = (text: string, size: number, leading: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    for (const line of lines) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += leading;
    }
  };

  write(title || `Transcript — ${t.video_id}`, 15, 20, true);
  write(caption(t), 10, 16);
  y += 8;

  for (const segment of t.segments) {
    write(`${formatClock(segment.start)}  ${segment.text}`, 11, 15);
    y += 3;
  }

  return doc.output("blob");
}

export async function buildExport(
  format: ExportFormat,
  transcript: Transcript,
  title?: string | null,
  opts: ExportOptions = DEFAULT_EXPORT_OPTIONS,
): Promise<{ blob: Blob; filename: string }> {
  const base = opts.filename.trim() || defaultExportName(transcript, title);
  switch (format) {
    case "srt":
      return { blob: new Blob([toSrt(transcript)], { type: "text/plain;charset=utf-8" }), filename: `${base}.srt` };
    case "vtt":
      return { blob: new Blob([toVtt(transcript)], { type: "text/vtt;charset=utf-8" }), filename: `${base}.vtt` };
    case "md":
      return { blob: new Blob([toMarkdown(transcript, title, opts)], { type: "text/markdown;charset=utf-8" }), filename: `${base}.md` };
    case "csv":
      return { blob: new Blob([toCsv(transcript, opts, title)], { type: "text/csv;charset=utf-8" }), filename: `${base}.csv` };
    case "docx":
      return { blob: await toDocx(transcript, opts, title), filename: `${base}.docx` };
    case "pdf":
      return { blob: toPdf(transcript, title), filename: `${base}.pdf` };
    default:
      return { blob: new Blob([toTxt(transcript, opts)], { type: "text/plain;charset=utf-8" }), filename: `${base}.txt` };
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
