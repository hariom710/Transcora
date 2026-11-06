import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_EXPORT_OPTIONS,
  EXPORT_FORMATS,
  buildExport,
  filterSegments,
  toCsv,
  toMarkdown,
  toParagraphs,
  toPlainText,
  toPdf,
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
    expect(vtt.blob.type).toContain("text/vtt");
    expect(await vtt.blob.text()).toContain("WEBVTT");

    const md = await buildExport("md", TRANSCRIPT, "Python Tutorial");
    expect(md.filename).toBe("Python Tutorial.md");

    const txt = await buildExport("txt", TRANSCRIPT, "Python Tutorial");
    expect(txt.filename).toBe("Python Tutorial.txt");

    const pdf = await buildExport("pdf", TRANSCRIPT, "Python Tutorial");
    expect(pdf.filename).toBe("Python Tutorial.pdf");
    expect(pdf.blob.type).toContain("application/pdf");
    expect(pdf.blob.size).toBeGreaterThan(0);

    const csv = await buildExport("csv", TRANSCRIPT, "Python Tutorial");
    expect(csv.filename).toBe("Python Tutorial.csv");
    expect(csv.blob.type).toContain("text/csv");

    const docx = await buildExport("docx", TRANSCRIPT, "Python Tutorial");
    expect(docx.filename).toBe("Python Tutorial.docx");
    expect(docx.blob.type).toContain("wordprocessingml.document");
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

  it("keeps Unicode in filenames but still strips path characters", async () => {
    expect((await buildExport("txt", TRANSCRIPT, "Café — Resumen ñoño")).filename).toBe(
      "Café — Resumen ñoño.txt",
    );
    expect((await buildExport("txt", TRANSCRIPT, "日本語のタイトル")).filename).toBe(
      "日本語のタイトル.txt",
    );
  });
});

const MULTILINGUAL: Transcript = {
  ...TRANSCRIPT,
  segments: [
    { id: 1, start: 0, duration: 2, text: "Привет, мир! Это тест." },
    { id: 2, start: 2, duration: 2, text: "Καλημέρα κόσμε!" },
    { id: 3, start: 4, duration: 2, text: "¿Cómo estás, señor Muñoz? Größe." },
    { id: 4, start: 6, duration: 2, text: "Zażółć gęślą jaźń — ěščřžýáíé." },
  ],
};

describe("unicode across text formats", () => {
  it("round-trips Cyrillic, Greek and Latin Extended through every string exporter", async () => {
    for (const format of ["txt", "srt", "vtt", "md", "csv"] as const) {
      const { blob } = await buildExport(format, MULTILINGUAL, "Ünïcode");
      const text = await blob.text();
      expect(text, format).toContain("Привет, мир! Это тест.");
      expect(text, format).toContain("Καλημέρα κόσμε!");
      expect(text, format).toContain("Zażółć gęślą jaźń");
    }
  });

  it("keeps edited Unicode content in SRT", () => {
    const edited: Transcript = {
      ...MULTILINGUAL,
      segments: [{ ...MULTILINGUAL.segments[0], text: "Отредактировано: 修改済み" }],
    };
    expect(toSrt(edited)).toContain("Отредактировано: 修改済み");
  });
});

// Minimal ZIP central-directory reader (DOCX is a ZIP): lets us assert on the
// real word/document.xml without adding an unzip dependency.
function readZipEntry(buf: Uint8Array, entryName: string): string {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a ZIP: no end-of-central-directory record");
  const count = view.getUint16(eocd + 10, true);
  let off = view.getUint32(eocd + 16, true);
  for (let i = 0; i < count; i++) {
    if (view.getUint32(off, true) !== 0x02014b50) throw new Error("corrupt central directory");
    const method = view.getUint16(off + 10, true);
    const compSize = view.getUint32(off + 20, true);
    const nameLen = view.getUint16(off + 28, true);
    const extraLen = view.getUint16(off + 30, true);
    const commentLen = view.getUint16(off + 32, true);
    const localOff = view.getUint32(off + 42, true);
    const name = new TextDecoder().decode(buf.subarray(off + 46, off + 46 + nameLen));
    if (name === entryName) {
      const dataStart = localOff + 30 + view.getUint16(localOff + 26, true) + view.getUint16(localOff + 28, true);
      const data = buf.subarray(dataStart, dataStart + compSize);
      return new TextDecoder().decode(method === 8 ? inflateRawSync(data) : data);
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`ZIP entry not found: ${entryName}`);
}

describe("DOCX package (TESTING.md §N)", () => {
  it("is a valid ZIP whose document.xml carries text, Unicode and metadata", async () => {
    const { blob } = await buildExport("docx", MULTILINGUAL, "Ünïcode Title", {
      ...DEFAULT_EXPORT_OPTIONS,
      metadata: true,
      timestamps: true,
    });
    const xml = readZipEntry(new Uint8Array(await blob.arrayBuffer()), "word/document.xml");
    expect(xml).toContain("Привет, мир! Это тест.");
    expect(xml).toContain("Καλημέρα κόσμε!");
    expect(xml).toContain("Zażółć gęślą jaźń");
    expect(xml).toContain("Ünïcode Title");
    expect(xml).toContain("00:00");
    expect(xml).toContain("Language: English");
  });

  it("honours timestamps off", async () => {
    const { blob } = await buildExport("docx", TRANSCRIPT, "Title", {
      ...DEFAULT_EXPORT_OPTIONS,
      timestamps: false,
    });
    const xml = readZipEntry(new Uint8Array(await blob.arrayBuffer()), "word/document.xml");
    expect(xml).not.toContain("00:00");
    expect(xml).toContain("Welcome to today&apos;s programming tutorial.");
  });
});

const FONT_BYTES = new Uint8Array(
  readFileSync(fileURLToPath(new URL("../public/fonts/NotoSans-Regular.ttf", import.meta.url))),
);

describe("PDF with embedded Unicode font (ADR-013)", () => {
  it("embeds the font subset and maps non-Latin characters via ToUnicode", async () => {
    const blob = toPdf(MULTILINGUAL, "Ünïcode PDF", FONT_BYTES);
    expect(blob.type).toContain("application/pdf");
    const s = Buffer.from(await blob.arrayBuffer()).toString("latin1");
    expect(s.startsWith("%PDF")).toBe(true);
    expect(s).toContain("%%EOF");
    // Font embedded as a TrueType file stream with a Unicode mapping table.
    expect(s).toContain("FontFile2");
    expect(s).toContain("beginbfchar");
    expect(s, "Cyrillic П").toMatch(/<041f>/i);
    expect(s, "Greek Κ").toMatch(/<039a>/i);
    expect(s, "Polish ł").toMatch(/<0142>/i);
    // Subset keeps the file small (full Noto Sans is ~556 KB).
    expect(blob.size).toBeLessThan(500_000);
  });

  it("falls back to base-14 Helvetica when no font bytes are given", async () => {
    const s = Buffer.from(await toPdf(TRANSCRIPT, "Plain", null).arrayBuffer()).toString("latin1");
    expect(s.startsWith("%PDF")).toBe(true);
    expect(s).not.toContain("FontFile2");
  });

  it("paginates long transcripts instead of clipping them", async () => {
    const segments = Array.from({ length: 4000 }, (_, i) => ({
      id: i + 1,
      start: i * 3,
      duration: 3,
      text: `Segment number ${i + 1} with enough words to occupy a line of transcript text.`,
    }));
    const long: Transcript = { ...TRANSCRIPT, segments };
    const s = Buffer.from(await toPdf(long, "Long", FONT_BYTES).arrayBuffer()).toString("latin1");
    const pages = (s.match(/\/Type \/Page(?!s)/g) ?? []).length;
    expect(pages).toBeGreaterThan(10);
    expect(s).toContain("%%EOF");
  });
});

describe("empty transcripts", () => {
  const EMPTY: Transcript = { ...TRANSCRIPT, segments: [] };

  it("produces empty-safe output from every exporter", () => {
    expect(toSrt(EMPTY)).toBe("");
    expect(toVtt(EMPTY)).toBe("WEBVTT\n");
    expect(toTxt(EMPTY)).toBe("");
    expect(toPlainText(EMPTY)).toBe("");
    expect(toCsv(EMPTY)).toBe("timestamp,text\r\n");
    expect(toMarkdown(EMPTY, "No captions")).toContain("# No captions");
    expect(toMarkdown(EMPTY, "No captions")).toContain("0 segments");
    expect(toPdf(EMPTY, "No captions", FONT_BYTES).size).toBeGreaterThan(0);
  });

  it("buildExport still returns correctly named and typed blobs", async () => {
    for (const format of EXPORT_FORMATS) {
      const { blob, filename } = await buildExport(format, EMPTY, "Empty");
      expect(filename, format).toBe(`Empty.${format}`);
      expect(blob.type, format).not.toBe("");
    }
  });
});

describe("large transcripts (TESTING.md §O)", () => {
  const BIG: Transcript = {
    ...TRANSCRIPT,
    segments: Array.from({ length: 5000 }, (_, i) => ({
      id: i + 1,
      start: i * 3,
      duration: 3,
      text: `Line ${i + 1} of the big transcript.`,
    })),
  };

  it("keeps SRT cue numbering sequential to the last cue", () => {
    const cues = toSrt(BIG).trim().split("\n\n");
    expect(cues).toHaveLength(5000);
    expect(cues[0].startsWith("1\n")).toBe(true);
    expect(cues[4999].startsWith("5000\n")).toBe(true);
  });

  it("writes one TXT line per segment", () => {
    expect(toTxt(BIG).split("\n")).toHaveLength(5000);
  });

  it("builds every string format without truncation", async () => {
    for (const format of ["txt", "srt", "vtt", "md", "csv"] as const) {
      const { blob } = await buildExport(format, BIG, "Big");
      expect(blob.size, format).toBeGreaterThan(1000);
    }
  });
});
