import { describe, expect, it } from "vitest";

import { countMatches, findMatches, highlightParts, wrapIndex } from "@/lib/search";

describe("findMatches", () => {
  it("is case insensitive", () => {
    expect(findMatches("Hello WORLD", "world")).toEqual([{ start: 6, end: 11 }]);
  });

  it("finds every occurrence", () => {
    expect(findMatches("a b a", "a")).toEqual([
      { start: 0, end: 1 },
      { start: 4, end: 5 },
    ]);
  });

  it("returns nothing for an empty query", () => {
    expect(findMatches("anything", "")).toEqual([]);
  });

  it("returns nothing when there is no match", () => {
    expect(findMatches("hello", "xyz")).toEqual([]);
  });

  it("does not count overlapping matches twice", () => {
    expect(findMatches("aaa", "aa")).toEqual([{ start: 0, end: 2 }]);
  });
});

describe("highlightParts", () => {
  it("splits around a single match", () => {
    expect(highlightParts("hello world", "world")).toEqual([
      { text: "hello ", hit: false },
      { text: "world", hit: true },
    ]);
  });

  it("returns one plain part when there is no match", () => {
    expect(highlightParts("hello", "zzz")).toEqual([{ text: "hello", hit: false }]);
  });

  it("handles a match at the very start", () => {
    expect(highlightParts("abc", "ab")).toEqual([
      { text: "ab", hit: true },
      { text: "c", hit: false },
    ]);
  });

  it("reconstructs the original text", () => {
    const original = "variables are used to store values";
    const parts = highlightParts(original, "are");
    expect(parts.map((part) => part.text).join("")).toBe(original);
  });
});

describe("countMatches", () => {
  it("counts across segments", () => {
    const segments = [{ text: "one two" }, { text: "two three two" }];
    expect(countMatches(segments, "two")).toBe(3);
  });

  it("returns zero for an empty query", () => {
    expect(countMatches([{ text: "anything" }], "")).toBe(0);
  });
});

describe("wrapIndex", () => {
  it("wraps backwards to the last item and forwards to the first (T3 D2)", () => {
    expect(wrapIndex(-1, 3)).toBe(2);
    expect(wrapIndex(3, 3)).toBe(0);
    expect(wrapIndex(1, 3)).toBe(1);
    expect(wrapIndex(-4, 3)).toBe(2);
  });

  it("returns 0 when there is nothing to index", () => {
    expect(wrapIndex(-1, 0)).toBe(0);
    expect(wrapIndex(5, 0)).toBe(0);
  });
});
