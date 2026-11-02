import { jsPDF } from "jspdf";

import type { Transcript } from "@/types";
import { formatClock, formatSrtTime, formatVttTime } from "./timestamp";

export type ExportFormat = "txt" | "srt" | "vtt" | "md" | "pdf";

export const EXPORT_LABELS: Record<ExportFormat, string> = {
  txt: "TXT",
  srt: "SRT",
  vtt: "VTT",
  md: "MD",
  pdf: "PDF",
};

function caption(t: Transcript): string {
  return t.is_generated ? `${t.language} (auto-generated)` : t.language;
}

export function toTxt(t: Transcript): string {
  return t.segments.map((s) => `${formatClock(s.start)} ${s.text}`).join("\n");
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

export function toMarkdown(t: Transcript, title?: string | null): string {
  const heading = `# ${title || `Transcript — ${t.video_id}`}\n\n`;
  const meta = `_Language: ${caption(t)} · ${t.segments.length} segments_\n\n`;
  const body = t.segments
    .map((s) => `**${formatClock(s.start)}** ${s.text}`)
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

export function buildExport(
  format: ExportFormat,
  transcript: Transcript,
  title?: string | null,
): { blob: Blob; filename: string } {
  const base = (title || transcript.video_id).replace(/[^\w\- ]+/g, "").trim() || "transcript";
  switch (format) {
    case "srt":
      return { blob: new Blob([toSrt(transcript)], { type: "text/plain;charset=utf-8" }), filename: `${base}.srt` };
    case "vtt":
      return { blob: new Blob([toVtt(transcript)], { type: "text/vtt;charset=utf-8" }), filename: `${base}.vtt` };
    case "md":
      return { blob: new Blob([toMarkdown(transcript, title)], { type: "text/markdown;charset=utf-8" }), filename: `${base}.md` };
    case "pdf":
      return { blob: toPdf(transcript, title), filename: `${base}.pdf` };
    default:
      return { blob: new Blob([toTxt(transcript)], { type: "text/plain;charset=utf-8" }), filename: `${base}.txt` };
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
