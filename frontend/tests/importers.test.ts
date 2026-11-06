import { describe, expect, it } from "vitest";

import { detectFormat, parseImport } from "@/lib/importers";

const SRT = `1
00:00:01,000 --> 00:00:03,500
First cue

2
00:00:04,000 --> 00:00:06,000
Second cue
spans two lines

3
00:01:02,250 --> 00:01:04,000
Third — with émojis 🎵
`;

const VTT = `WEBVTT - demo file

NOTE this is a comment
with a --> arrow that must not parse

intro
00:01.000 --> 00:03.000 line:0 align:start
Hello vtt

00:00:12.500 --> 00:00:14.000
Seconds-only timing
`;

const MD = `# Heading

- bullet one
* bullet two
3. numbered

Plain line
`;

describe("detectFormat", () => {
  it("prefers the file extension, then sniffs content", () => {
    expect(detectFormat("a.srt", "whatever")).toBe("srt");
    expect(detectFormat("a.vtt", "whatever")).toBe("vtt");
    expect(detectFormat("notes.md", "whatever")).toBe("md");
    expect(detectFormat("notes.markdown", "whatever")).toBe("md");
    expect(detectFormat("plain.txt", "whatever")).toBe("txt");
    expect(detectFormat("noext", "WEBVTT\n")).toBe("vtt");
    expect(detectFormat("noext", "1\n00:00:00,000 --> 00:00:01,000\nhi")).toBe("srt");
    expect(detectFormat("noext", "just text")).toBe("txt");
  });
});

describe("parseImport SRT", () => {
  it("parses cues with CRLF-safe timing, joins wrapped lines, keeps unicode", () => {
    const parsed = parseImport("sub.srt", SRT.replace(/\n/g, "\r\n"));
    expect(parsed.segments).toEqual([
      { id: 1, start: 1, duration: 2.5, text: "First cue" },
      { id: 2, start: 4, duration: 2, text: "Second cue spans two lines" },
      { id: 3, start: 62.25, duration: 1.75, text: "Third — with émojis 🎵" },
    ]);
    expect(parsed.language_code).toBe("und");
    expect(parsed.is_generated).toBe(false);
    expect(parsed.video_id).toMatch(/^[A-Za-z0-9_-]{11}$/);
  });
});

describe("parseImport VTT", () => {
  it("skips the header, NOTE blocks and cue ids; handles settings and MM:SS", () => {
    const parsed = parseImport("sub.vtt", VTT);
    expect(parsed.segments).toEqual([
      { id: 1, start: 1, duration: 2, text: "Hello vtt" },
      { id: 2, start: 12.5, duration: 1.5, text: "Seconds-only timing" },
    ]);
  });
});

describe("parseImport text/markdown", () => {
  it("keeps non-empty lines, strips markers and estimates 3s per line", () => {
    const parsed = parseImport("notes.md", MD);
    expect(parsed.segments.map((segment) => segment.text)).toEqual([
      "Heading",
      "bullet one",
      "bullet two",
      "numbered",
      "Plain line",
    ]);
    expect(parsed.segments[1].start).toBe(3);
    expect(parsed.segments[4].start).toBe(12);
  });

  it("throws on files without usable content", () => {
    expect(() => parseImport("empty.txt", "  \n \n")).toThrow(/no text lines/);
    expect(() => parseImport("fake.srt", "not cues at all")).toThrow(/no valid SRT\/VTT/);
  });

  it("gives each import a fresh synthetic id", () => {
    const a = parseImport("x.txt", "line");
    const b = parseImport("x.txt", "line");
    expect(a.video_id).not.toBe(b.video_id);
  });
});
