import type { TranscriptSegment } from "@/types";

/**
 * Segment visible at `time`: the last one that has started (binary search).
 * Segments are ordered by start time — the provider returns them sorted and
 * normalization preserves order. Highlights persist through caption gaps;
 * before the first segment there is nothing to show.
 */
export function findActiveSegment(
  segments: readonly TranscriptSegment[],
  time: number,
): number | null {
  let low = 0;
  let high = segments.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (segments[mid].start <= time) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found === -1 ? null : segments[found].id;
}
