import type { Transcript, TranscriptSegment } from "@/types";

export type ImportFormat = "srt" | "vtt" | "md" | "txt";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

/** Synthetic 11-char id shaped like a YouTube id so shares, exports and the
    workspace all keep working; it never resolves to a real video unless it
    collides by chance. */
function syntheticVideoId(): string {
  const bytes = new Uint8Array(11);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let id = "";
  for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length]; // 256 % 64 === 0, uniform
  return id;
}

export function detectFormat(filename: string, text: string): ImportFormat {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "srt") return "srt";
  if (ext === "vtt") return "vtt";
  if (ext === "md" || ext === "markdown") return "md";
  if (ext === "txt") return "txt";
  const head = text.trimStart();
  if (head.startsWith("WEBVTT")) return "vtt";
  if (/^\d+\s*\r?\n[\d:,.]+ *-->/.test(head)) return "srt";
  return "txt";
}

/** HH:MM:SS,mmm / MM:SS.mmm timing with optional cue settings after the end. */
const CUE_TIME =
  /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[,.](\d{1,3})\s*-->\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[,.](\d{1,3})/;

function toSeconds(hours: string | undefined, minutes: string, seconds: string, ms: string) {
  const fraction = Number.parseInt(ms.padEnd(3, "0"), 10) / 1000;
  return Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(seconds) + fraction;
}

function parseCues(text: string): TranscriptSegment[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const segments: TranscriptSegment[] = [];
  let id = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("NOTE")) {
      while (i < lines.length && lines[i].trim() !== "") i++; // skip comment blocks
      continue;
    }
    const match = CUE_TIME.exec(line);
    if (!match) continue;
    const start = toSeconds(match[1], match[2], match[3], match[4]);
    const end = toSeconds(match[5], match[6], match[7], match[8]);
    const textLines: string[] = [];
    while (i + 1 < lines.length && lines[i + 1].trim() !== "") {
      i++;
      textLines.push(lines[i].trim());
    }
    const cueText = textLines.join(" ").trim();
    if (!cueText) continue;
    id += 1;
    segments.push({ id, start, duration: Math.max(0, end - start), text: cueText });
  }
  return segments;
}

const MARKER_RE = /^(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+)/;

/** Plain text / Markdown: one segment per line, stripped of list/heading
    markers. Timestamps are estimated at 3 s per line — files carry none. */
function parseLines(text: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let id = 0;
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const clean = raw.replace(MARKER_RE, "").trim();
    if (!clean) continue;
    id += 1;
    segments.push({ id, start: (id - 1) * 3, duration: 3, text: clean });
  }
  return segments;
}

/** Parses an imported file (TXT/SRT/VTT/MD) into a Transcript.
    @throws when the file holds no transcript content. */
export function parseImport(filename: string, text: string): Transcript {
  const format = detectFormat(filename, text);
  const segments =
    format === "srt" || format === "vtt" ? parseCues(text) : parseLines(text);
  if (segments.length === 0) {
    throw new Error(
      format === "txt" || format === "md"
        ? "That file has no text lines."
        : "No captions found — the file has no valid SRT/VTT cues.",
    );
  }
  return {
    video_id: syntheticVideoId(),
    language: "Imported",
    language_code: "und",
    is_generated: false,
    segments,
  };
}
