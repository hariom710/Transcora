import { describe, expect, it } from "vitest";

import { buildExport, toMarkdown, toSrt, toTxt, toVtt } from "@/lib/export";
import type { Transcript } from "@/types";

const TRANSCRIPT: Transcript = {
  video_id: "dQw4w9WgXcQ",
  language: "English",
  language_code: "en",
  is_generated: false,
  segments: [
    { id: 1, start: 0, duration: 3.5, text: "Welcome to today's programming tutorial." },
    { id: 2, start: 3.5, duration: 4.2, text: "Today we will learn Python fundamentals." },
  ],
};

describe("toSrt", () => {
  it("produces valid SRT with comma decimals", () => {
    expect(toSrt(TRANSCRIPT)).toBe(
      "1\n" +
        "00:00:00,000 --> 00:00:03,500\n" +
        "Welcome to today's programming tutorial.\n" +
        "\n" +
        "2\n" +
        "00:00:03,500 --> 00:00:07,700\n" +
        "Today we will learn Python fundamentals.\n",
    );
  });
});

describe("toVtt", () => {
  it("produces WebVTT with a header and dot decimals", () => {
    expect(toVtt(TRANSCRIPT)).toBe(
      "WEBVTT\n" +
        "\n" +
        "00:00:00.000 --> 00:00:03.500\n" +
        "Welcome to today's programming tutorial.\n" +
        "\n" +
        "00:00:03.500 --> 00:00:07.700\n" +
        "Today we will learn Python fundamentals.\n",
    );
  });
});

describe("toTxt", () => {
  it("prefixes each line with a compact timestamp", () => {
    expect(toTxt(TRANSCRIPT)).toBe(
      "00:00 Welcome to today's programming tutorial.\n" +
        "00:03 Today we will learn Python fundamentals.",
    );
  });
});

describe("toMarkdown", () => {
  it("includes a heading, language metadata and bold timestamps", () => {
    const output = toMarkdown(TRANSCRIPT, "Python Programming Tutorial");
    expect(output).toContain("# Python Programming Tutorial");
    expect(output).toContain("English");
    expect(output).toContain("**00:00** Welcome");
    expect(output).toContain("**00:03** Today");
  });

  it("falls back to the video id when there is no title", () => {
    expect(toMarkdown(TRANSCRIPT)).toContain("# Transcript — dQw4w9WgXcQ");
  });
});

describe("edited transcripts", () => {
  it("exports the edited text, not the original", () => {
    const edited: Transcript = {
      ...TRANSCRIPT,
      segments: [{ ...TRANSCRIPT.segments[0], text: "Edited sentence." }, TRANSCRIPT.segments[1]],
    };

    expect(toSrt(edited)).toContain("Edited sentence.");
    expect(toSrt(edited)).not.toContain("Welcome to today's programming tutorial.");
  });
});

describe("buildExport", () => {
  it("returns a named blob for each format", async () => {
    const srt = buildExport("srt", TRANSCRIPT, "Python Tutorial");
    expect(srt.filename).toBe("Python Tutorial.srt");
    expect(srt.blob.type).toContain("text/plain");
    expect(await srt.blob.text()).toContain("00:00:00,000 -->");

    const vtt = buildExport("vtt", TRANSCRIPT, "Python Tutorial");
    expect(vtt.filename).toBe("Python Tutorial.vtt");
    expect(await vtt.blob.text()).toContain("WEBVTT");

    const md = buildExport("md", TRANSCRIPT, "Python Tutorial");
    expect(md.filename).toBe("Python Tutorial.md");

    const txt = buildExport("txt", TRANSCRIPT, "Python Tutorial");
    expect(txt.filename).toBe("Python Tutorial.txt");

    const pdf = buildExport("pdf", TRANSCRIPT, "Python Tutorial");
    expect(pdf.filename).toBe("Python Tutorial.pdf");
    expect(pdf.blob.size).toBeGreaterThan(0);
  });

  it("strips path separators from unsafe titles", () => {
    expect(buildExport("txt", TRANSCRIPT, "../../etc/passwd").filename).not.toMatch(/[\\/]/);
    expect(buildExport("txt", TRANSCRIPT, "../../etc/passwd").filename).toBe("etcpasswd.txt");
  });

  it("falls back to a safe name when nothing is left of the title", () => {
    expect(buildExport("txt", TRANSCRIPT, "///").filename).toBe("transcript.txt");
  });
});
