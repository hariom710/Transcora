import type { TranscriptSegment } from "@/types";

export type Edits = Record<number, string>;

/** Spoken fillers safe to drop; "huh" kept for the "uh-huh" compound. */
const FILLER_RE = /\b(?:uh+|um+|erm|er|hmm+|mmm+|huh)\b[,.!?-]?\s*/gi;

/** Removes spoken fillers, then re-normalises the leftover spacing. */
export function removeFillers(text: string): string {
  return text.replace(FILLER_RE, " ").replace(/\s+/g, " ").trim();
}

/** Fixes caption artefacts: repeated whitespace and space before punctuation. */
export function cleanupText(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive literal replace over every segment; returns only changed rows. */
export function replaceAll(
  segments: readonly TranscriptSegment[],
  query: string,
  replacement: string,
): Edits {
  if (!query) return {};
  const pattern = new RegExp(escapeRegExp(query), "gi");
  return bulkTransform(segments, (text) => text.replace(pattern, () => replacement));
}

/** Applies fn to every segment, keeping only rows whose text actually changed.
    Blank results are ignored so a tool can never wipe a segment. */
export function bulkTransform(
  segments: readonly TranscriptSegment[],
  fn: (text: string) => string,
): Edits {
  const next: Edits = {};
  for (const segment of segments) {
    const text = fn(segment.text);
    if (text && text !== segment.text) next[segment.id] = text;
  }
  return next;
}

/** Reading time at 200 wpm, minimum one minute. */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 200));
}

/** Immutable add/remove toggle for the annotation id sets. */
export function toggleId(set: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
