import { describe, expect, it } from "vitest";

import {
  bulkTransform,
  cleanupText,
  readingMinutes,
  removeFillers,
  replaceAll,
  toggleId,
} from "@/lib/productivity";
import { historyReducer, type EditHistory } from "@/hooks/use-edit-history";
import type { TranscriptSegment } from "@/types";

const SEGMENTS: TranscriptSegment[] = [
  { id: 1, start: 0, duration: 4, text: "Um, so I think we should start now." },
  { id: 2, start: 4, duration: 3, text: "The  number  is  here ," },
  { id: 3, start: 7, duration: 2, text: "uh-huh, that works" },
];

describe("removeFillers", () => {
  it("drops spoken fillers and their punctuation", () => {
    expect(removeFillers("Um, so I think we should start now.")).toBe("so I think we should start now.");
    expect(removeFillers("I was, um, thinking.")).toBe("I was, thinking.");
    expect(removeFillers("Hmm, wait.")).toBe("wait.");
  });

  it("removes the uh-huh compound entirely", () => {
    expect(removeFillers("uh-huh, that works")).toBe("that works");
  });

  it("keeps real words that contain filler sounds", () => {
    expect(removeFillers("The number is here")).toBe("The number is here");
    expect(removeFillers("her eraser")).toBe("her eraser");
  });

  it("leaves clean text unchanged", () => {
    expect(removeFillers("Plain caption text.")).toBe("Plain caption text.");
  });
});

describe("cleanupText", () => {
  it("collapses whitespace and removes space before punctuation", () => {
    expect(cleanupText("The  number  is  here ,")).toBe("The number is here,");
    expect(cleanupText("  padded  ")).toBe("padded");
  });

  it("leaves clean text unchanged", () => {
    expect(cleanupText("Clean text.")).toBe("Clean text.");
  });
});

describe("replaceAll", () => {
  it("replaces case-insensitively and returns only changed rows", () => {
    const edits = replaceAll(SEGMENTS, "is", "was");
    expect(edits[2]).toBe("The  number  was  here ,");
    expect(edits[1]).toBeUndefined();
    expect(edits[3]).toBeUndefined();
  });

  it("treats the replacement literally ($& is not a pattern)", () => {
    const edits = replaceAll(SEGMENTS, "think", "$& kept");
    expect(edits[1]).toBe("Um, so I $& kept we should start now.");
  });

  it("is a no-op without a query", () => {
    expect(replaceAll(SEGMENTS, "", "x")).toEqual({});
  });
});

describe("bulkTransform", () => {
  it("returns only segments whose text changed", () => {
    const edits = bulkTransform(SEGMENTS, cleanupText);
    expect(Object.keys(edits)).toEqual(["2"]);
  });

  it("never blanks a segment", () => {
    const edits = bulkTransform(SEGMENTS, () => "");
    expect(edits).toEqual({});
  });
});

describe("readingMinutes", () => {
  it("rounds at 200 wpm with a one-minute floor", () => {
    expect(readingMinutes(0)).toBe(1);
    expect(readingMinutes(400)).toBe(2);
    expect(readingMinutes(100)).toBe(1);
  });
});

describe("toggleId", () => {
  it("adds then removes an id", () => {
    let set = toggleId(new Set<number>(), 5);
    expect(set.has(5)).toBe(true);
    set = toggleId(set, 5);
    expect(set.has(5)).toBe(false);
  });
});

describe("historyReducer", () => {
  const empty: EditHistory = { past: [], present: {}, future: [] };

  it("patch merges into present and stores one undo step", () => {
    const state = historyReducer(empty, { type: "patch", partial: { 1: "a" } });
    expect(state.present).toEqual({ 1: "a" });
    const second = historyReducer(state, { type: "patch", partial: { 2: "b" } });
    expect(second.present).toEqual({ 1: "a", 2: "b" });
    expect(second.past).toEqual([{}, { 1: "a" }]);

    const undone = historyReducer(second, { type: "undo" });
    expect(undone.present).toEqual({ 1: "a" });
    expect(undone.future).toEqual([{ 1: "a", 2: "b" }]);

    const redone = historyReducer(undone, { type: "redo" });
    expect(redone.present).toEqual({ 1: "a", 2: "b" });
  });

  it("ignores undo/redo with empty stacks and identical commits", () => {
    expect(historyReducer(empty, { type: "undo" })).toBe(empty);
    expect(historyReducer(empty, { type: "redo" })).toBe(empty);
    const same = historyReducer(empty, { type: "patch", partial: {} });
    expect(same).toBe(empty);
  });

  it("clears the redo stack after a new edit", () => {
    const a = historyReducer(empty, { type: "patch", partial: { 1: "a" } });
    const undone = historyReducer(a, { type: "undo" });
    const next = historyReducer(undone, { type: "patch", partial: { 3: "c" } });
    expect(next.future).toEqual([]);
    expect(next.present).toEqual({ 3: "c" });
  });

  it("caps the undo stack at 50 entries", () => {
    let state = empty;
    for (let i = 0; i < 60; i++) {
      state = historyReducer(state, { type: "patch", partial: { [i]: `v${i}` } });
    }
    expect(state.past).toHaveLength(50);
  });
});
