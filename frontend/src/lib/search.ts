export interface HighlightPart {
  text: string;
  hit: boolean;
}

/** Case-insensitive, non-overlapping match ranges within `text`. */
export function findMatches(text: string, query: string): Array<{ start: number; end: number }> {
  if (!query) return [];
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  const ranges: Array<{ start: number; end: number }> = [];
  let cursor = 0;

  while (cursor <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, cursor);
    if (index === -1) break;
    ranges.push({ start: index, end: index + needle.length });
    cursor = index + needle.length;
  }
  return ranges;
}

/** Positive-modulo wrap so prev/next navigation cycles instead of going negative. */
export function wrapIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

/** Splits `text` into alternating hit/non-hit parts ready for rendering. */
export function highlightParts(text: string, query: string): HighlightPart[] {
  const ranges = findMatches(text, query);
  if (ranges.length === 0) return [{ text, hit: false }];

  const parts: HighlightPart[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) parts.push({ text: text.slice(cursor, range.start), hit: false });
    parts.push({ text: text.slice(range.start, range.end), hit: true });
    cursor = range.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return parts;
}

export function countMatches(segments: ReadonlyArray<{ text: string }>, query: string): number {
  if (!query) return 0;
  return segments.reduce((total, segment) => total + findMatches(segment.text, query).length, 0);
}
