import { describe, expect, it } from "vitest";

import { diffLines, diffStats } from "@/lib/compare";

describe("diffLines", () => {
  it("reports identical lists as all same", () => {
    const lines = diffLines(["a", "b"], ["a", "b"]);
    expect(lines).toEqual([
      { kind: "same", text: "a" },
      { kind: "same", text: "b" },
    ]);
    expect(diffStats(lines)).toEqual({ same: 2, removed: 0, added: 0 });
  });

  it("detects an inserted line while keeping prefix and suffix aligned", () => {
    const lines = diffLines(["a", "c"], ["a", "b", "c"]);
    expect(lines).toEqual([
      { kind: "same", text: "a" },
      { kind: "added", text: "b" },
      { kind: "same", text: "c" },
    ]);
  });

  it("detects a removed line", () => {
    const lines = diffLines(["a", "b", "c"], ["a", "c"]);
    expect(lines).toEqual([
      { kind: "same", text: "a" },
      { kind: "removed", text: "b" },
      { kind: "same", text: "c" },
    ]);
  });

  it("pairs a replacement as removed + added", () => {
    const stats = diffStats(diffLines(["a", "x", "z"], ["a", "y", "z"]));
    expect(stats).toEqual({ same: 2, removed: 1, added: 1 });
  });

  it("handles empty sides", () => {
    expect(diffLines([], [])).toEqual([]);
    expect(diffLines([], ["a"])).toEqual([{ kind: "added", text: "a" }]);
    expect(diffLines(["a"], [])).toEqual([{ kind: "removed", text: "a" }]);
  });

  it("keeps order stable for multi-line edits", () => {
    const lines = diffLines(["keep", "old1", "old2", "keep2"], ["keep", "new1", "keep2"]);
    expect(lines.map((line) => `${line.kind}:${line.text}`)).toEqual([
      "same:keep",
      "removed:old1",
      "removed:old2",
      "added:new1",
      "same:keep2",
    ]);
  });
});
