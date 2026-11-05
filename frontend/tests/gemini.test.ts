import { describe, expect, it } from "vitest";

import {
  AI_FEATURES,
  AiFailure,
  MAX_TRANSCRIPT_CHARS,
  applyLabels,
  buildTranscriptContext,
  extractText,
  generateContent,
  mapHttpError,
  parseLabels,
} from "@/lib/gemini";
import type { Transcript } from "@/types";

const TRANSCRIPT: Transcript = {
  video_id: "dQw4w9WgXcQ",
  language: "English",
  language_code: "en",
  is_generated: false,
  segments: [
    { id: 1, start: 0, duration: 4, text: "Welcome to the show." },
    { id: 2, start: 4, duration: 4, text: "Today we talk about testing." },
    { id: 3, start: 8, duration: 4, text: "[♪♪♪]" },
  ],
};

describe("AI features", () => {
  it("covers the seven Phase 10 feature prompts", () => {
    expect(AI_FEATURES.map((f) => f.id)).toEqual([
      "summary",
      "keypoints",
      "notes",
      "chapters",
      "topics",
      "learning",
    ]);
    for (const feature of AI_FEATURES) expect(feature.prompt.length).toBeGreaterThan(20);
  });
});

describe("buildTranscriptContext", () => {
  it("includes title, language and timestamps without truncating", () => {
    const context = buildTranscriptContext(TRANSCRIPT, "My Video");
    expect(context.system).toContain("Video: My Video");
    expect(context.system).toContain("Language: English");
    expect(context.system).toContain("[00:00] Welcome to the show.");
    expect(context.truncated).toBe(false);
    expect(context.totalChars).toBeLessThan(MAX_TRANSCRIPT_CHARS);
  });

  it("truncates loudly past the character budget", () => {
    const long: Transcript = {
      ...TRANSCRIPT,
      segments: [{ id: 1, start: 0, duration: 1, text: "x".repeat(MAX_TRANSCRIPT_CHARS) }],
    };
    const context = buildTranscriptContext(long, null);
    expect(context.truncated).toBe(true);
    expect(context.system).toContain("Transcript truncated at");
    expect(context.totalChars).toBeGreaterThan(MAX_TRANSCRIPT_CHARS);
    // The request stays bounded: budget + system prompt + truncation notice.
    expect(context.system.length).toBeLessThan(MAX_TRANSCRIPT_CHARS + 1_000);
  });
});

describe("mapHttpError", () => {
  it("maps quota, invalid key and generic failures to distinct safe messages", () => {
    expect(mapHttpError(429, "{}").kind).toBe("quota");
    expect(mapHttpError(429, "{}").message).toMatch(/wait/i);

    const invalid = mapHttpError(400, '{"error":{"message":"API_KEY_INVALID"}}');
    expect(invalid.kind).toBe("invalid-key");

    expect(mapHttpError(403, "{}").kind).toBe("invalid-key");
    expect(mapHttpError(404, "{}").kind).toBe("request");
    expect(mapHttpError(500, "{}").kind).toBe("request");
    expect(mapHttpError(500, "boom")).not.toContain("boom"); // body never leaks through
  });
});

describe("extractText", () => {
  it("reads the candidate text and tolerates malformed shapes", () => {
    expect(
      extractText({ candidates: [{ content: { parts: [{ text: "hello" }, { text: "world" }] } }] }),
    ).toBe("helloworld");
    expect(extractText(null)).toBe("");
    expect(extractText({})).toBe("");
    expect(extractText({ candidates: [] })).toBe("");
    expect(extractText({ candidates: [{ content: { parts: [{ nope: 1 }] } }] })).toBe("");
    expect(extractText({ candidates: [{ content: { parts: "junk" } }] })).toBe("");
  });
});

describe("generateContent", () => {
  it("fails fast with a missing-key error before any network call", async () => {
    await expect(
      generateContent({ key: "   ", system: "s", messages: [{ role: "user", text: "hi" }] }),
    ).rejects.toMatchObject({ kind: "missing-key" });
  });
});

describe("parseLabels", () => {
  it("keeps valid labels and drops unknown ids and bad shapes", () => {
    const json = JSON.stringify({
      labels: [
        { id: 1, speaker: "Speaker 1" },
        { id: 99, speaker: "Ghost" },
        { id: 2, speaker: 42 },
        "junk",
        { id: 3, speaker: "Host]  two\nlines" },
      ],
    });
    const labels = parseLabels(json, new Set([1, 2, 3]));
    expect(labels).toEqual([
      { id: 1, speaker: "Speaker 1" },
      { id: 3, speaker: "Host two lines" },
    ]);
  });

  it("throws a safe error on unreadable or empty payloads", () => {
    expect(() => parseLabels("not json", new Set([1]))).toThrowError(AiFailure);
    expect(() => parseLabels('{"labels":"nope"}', new Set([1]))).toThrowError(/unexpected label/);
    expect(() => parseLabels('{"labels":[]}', new Set([1]))).toThrowError(/No usable/);
  });
});

describe("applyLabels", () => {
  it("prefixes untagged segments and skips already-tagged or music rows", () => {
    const changes = applyLabels(TRANSCRIPT.segments, [
      { id: 1, speaker: "Host" },
      { id: 3, speaker: "Music" },
      { id: 99, speaker: "Ghost" },
    ]);
    expect(changes).toEqual({ 1: "[Host] Welcome to the show." });
  });
});
