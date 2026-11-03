import { describe, expect, it } from "vitest";

import { findActiveSegment } from "@/lib/playback";
import type { TranscriptSegment } from "@/types";

const SEGMENTS: TranscriptSegment[] = [
  { id: 1, start: 0, duration: 3.5, text: "Intro." },
  { id: 2, start: 3.5, duration: 4.2, text: "Topic one." },
  // Caption gap: 7.7 → 12.0
  { id: 3, start: 12, duration: 5, text: "Topic two." },
];

describe("findActiveSegment", () => {
  it("returns null for an empty transcript", () => {
    expect(findActiveSegment([], 10)).toBeNull();
  });

  it("returns null before the first segment starts", () => {
    const late: TranscriptSegment[] = [{ id: 7, start: 5, duration: 2, text: "Later." }];
    expect(findActiveSegment(late, 4.99)).toBeNull();
  });

  it("returns the segment at an exact start boundary", () => {
    expect(findActiveSegment(SEGMENTS, 3.5)).toBe(2);
    expect(findActiveSegment(SEGMENTS, 12)).toBe(3);
  });

  it("returns the segment containing the time", () => {
    expect(findActiveSegment(SEGMENTS, 0)).toBe(1);
    expect(findActiveSegment(SEGMENTS, 5)).toBe(2);
    expect(findActiveSegment(SEGMENTS, 16.9)).toBe(3);
  });

  it("keeps the last started segment through a caption gap", () => {
    expect(findActiveSegment(SEGMENTS, 10)).toBe(2);
  });

  it("keeps the last segment after the transcript ends", () => {
    expect(findActiveSegment(SEGMENTS, 999)).toBe(3);
  });

  it("handles a single segment", () => {
    const one: TranscriptSegment[] = [{ id: 4, start: 2, duration: 1, text: "Only." }];
    expect(findActiveSegment(one, 2.5)).toBe(4);
    expect(findActiveSegment(one, 1.9)).toBeNull();
  });
});
