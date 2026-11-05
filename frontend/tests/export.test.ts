import { describe, expect, it } from "vitest";

import {
  DEFAULT_EXPORT_OPTIONS,
  buildExport,
  filterSegments,
  toCsv,
  toMarkdown,
  toParagraphs,
  toPlainText,
  toSrt,
  toTxt,
  toVtt,
} from "@/lib/export";
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

describe("toPlainText", () => {
  it("joins segment text without clock prefixes", () => {
    expect(toPlainText(TRANSCRIPT)).toBe(
      "Welcome to today's programming tutorial.\nToday we will learn Python fundamentals.",
    );
  });
});

describe("toCsv", () => {
  it("emits a timestamp column and RFC 4180 line endings", () => {
    const csv = toCsv(TRANSCRIPT);
    expect(csv).toBe(
      "timestamp,text\r\n" +
        "00:00,Welcome to today's programming tutorial.\r\n" +
        "00:03,Today we will learn Python fundamentals.\r\n",
    );
  });

  it("quotes cells containing commas and doubles quotes", () => {
    const tricky: Transcript = {
      ...TRANSCRIPT,
      segments: [{ id: 1, start: 0, duration: 1, text: 'He said "hi", then left.' }],
    };
    expect(toCsv(tricky)).toContain('"He said ""hi"", then left."');
  });

  it("prepends metadata rows when enabled", () => {
    const csv = toCsv(TRANSCRIPT, { ...DEFAULT_EXPORT_OPTIONS, metadata: true }, "Python Tutorial");
    expect(csv).toContain("Title,Python Tutorial");
    expect(csv).toContain("Language,English");
    expect(csv.split("\r\n\r\n")[0]).toContain("Source,https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("drops the timestamp column when timestamps are off", () => {
    const csv = toCsv(TRANSCRIPT, { ...DEFAULT_EXPORT_OPTIONS, timestamps: false });
    expect(csv.startsWith("text\r\n")).toBe(true);
    expect(csv).not.toContain("00:00");
  });
});

describe("export options", () => {
  it("toTxt honours timestamps off", () => {
    const txt = toTxt(TRANSCRIPT, { ...DEFAULT_EXPORT_OPTIONS, timestamps: false });
    expect(txt).toBe(
      "Welcome to today's programming tutorial.\nToday we will learn Python fundamentals.",
    );
  });

  it("toTxt groups into paragraphs at caption gaps", () => {
    const gapped: Transcript = {
      ...TRANSCRIPT,
      segments: [
        { id: 1, start: 0, duration: 2, text: "First sentence." },
        { id: 2, start: 2.5, duration: 2, text: "Second sentence." },
        { id: 3, start: 10, duration: 2, text: "After a long pause." },
      ],
    };
    const txt = toTxt(gapped, { ...DEFAULT_EXPORT_OPTIONS, formatting: "paragraphs" });
    expect(txt).toBe(
      "00:00 First sentence. 00:02 Second sentence.\n\n00:10 After a long pause.",
    );
  });

  it("toMarkdown can drop timestamps but keeps its heading", () => {
    const md = toMarkdown(TRANSCRIPT, "Python Tutorial", {
      ...DEFAULT_EXPORT_OPTIONS,
      timestamps: false,
    });
    expect(md).toContain("# Python Tutorial");
    expect(md).not.toContain("**00:00**");
  });
});

describe("filterSegments", () => {
  it("keeps only requested ids in transcript order", () => {
    const filtered = filterSegments(TRANSCRIPT, [2]);
    expect(filtered.segments).toHaveLength(1);
    expect(filtered.segments[0].text).toContain("Python fundamentals");
    expect(filterSegments(TRANSCRIPT, []).segments).toHaveLength(0);
  });
});

describe("toParagraphs", () => {
  it("splits where the caption gap exceeds the threshold", () => {
    const groups = toParagraphs(TRANSCRIPT.segments);
    // 3.5 → 3.5+4.2 = 7.7 boundary: second segment starts exactly at 3.5 (no gap).
    expect(groups).toHaveLength(1);

    const gapped = toParagraphs([
      { id: 1, start: 0, duration: 2, text: "a" },
      { id: 2, start: 9, duration: 2, text: "b" },
    ]);
    expect(gapped).toHaveLength(2);
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
    const srt = await buildExport("srt", TRANSCRIPT, "Python Tutorial");
    expect(srt.filename).toBe("Python Tutorial.srt");
    expect(srt.blob.type).toContain("text/plain");
    expect(await srt.blob.text()).toContain("00:00:00,000 -->");

    const vtt = await buildExport("vtt", TRANSCRIPT, "Python Tutorial");
    expect(vtt.filename).toBe("Python Tutorial.vtt");
    expect(await vtt.blob.text()).toContain("WEBVTT");

    const md = await buildExport("md", TRANSCRIPT, "Python Tutorial");
    expect(md.filename).toBe("Python Tutorial.md");

    const txt = await buildExport("txt", TRANSCRIPT, "Python Tutorial");
    expect(txt.filename).toBe("Python Tutorial.txt");

    const pdf = await buildExport("pdf", TRANSCRIPT, "Python Tutorial");
    expect(pdf.filename).toBe("Python Tutorial.pdf");
    expect(pdf.blob.size).toBeGreaterThan(0);

    const csv = await buildExport("csv", TRANSCRIPT, "Python Tutorial");
    expect(csv.filename).toBe("Python Tutorial.csv");
    expect(csv.blob.type).toContain("text/csv");

    const docx = await buildExport("docx", TRANSCRIPT, "Python Tutorial");
    expect(docx.filename).toBe("Python Tutorial.docx");
    expect(docx.blob.size).toBeGreaterThan(0);
    // A DOCX file starts with the ZIP local header "PK".
    expect(new Uint8Array(await docx.blob.arrayBuffer())[0]).toBe(0x50);
  });

  it("strips path separators from unsafe titles", async () => {
    expect((await buildExport("txt", TRANSCRIPT, "../../etc/passwd")).filename).not.toMatch(/[\\/]/);
    expect((await buildExport("txt", TRANSCRIPT, "../../etc/passwd")).filename).toBe("etcpasswd.txt");
  });

  it("falls back to a safe name when nothing is left of the title", async () => {
    expect((await buildExport("txt", TRANSCRIPT, "///")).filename).toBe("transcript.txt");
  });

  it("uses an explicit filename over the title", async () => {
    const result = await buildExport("csv", TRANSCRIPT, "Title", {
      timestamps: true,
      metadata: false,
      formatting: "segments",
      filename: "my export",
    });
    expect(result.filename).toBe("my export.csv");
  });
});
