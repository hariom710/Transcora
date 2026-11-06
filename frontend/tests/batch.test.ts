import { afterEach, describe, expect, it, vi } from "vitest";

import { BATCH_MAX, extractUrls, runBatch, type BatchItem } from "@/lib/batch";

function okResponse(videoId: string) {
  return {
    ok: true,
    json: async () => ({
      video_id: videoId,
      language: "English",
      language_code: "en",
      is_generated: true,
      segments: [{ id: 1, start: 0, duration: 1, text: "hi" }],
    }),
  };
}

function errorResponse(status: number, code: string, message: string) {
  return {
    ok: false,
    status,
    json: async () => ({ error: { code, message } }),
  };
}

const URLS = [
  "https://www.youtube.com/watch?v=aaaaaaaaaaa",
  "https://www.youtube.com/watch?v=bbbbbbbbbbb",
  "https://www.youtube.com/watch?v=cccccccccc",
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extractUrls", () => {
  it("splits on newlines and spaces, dropping empties", () => {
    expect(
      extractUrls("https://youtu.be/aaaaaaaaaaa\n\n https://youtu.be/bbbbbbbbbbb  \t tail"),
    ).toEqual(["https://youtu.be/aaaaaaaaaaa", "https://youtu.be/bbbbbbbbbbb", "tail"]);
  });
});

describe("runBatch", () => {
  it("rejects more than BATCH_MAX items before any request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const urls = Array.from({ length: BATCH_MAX + 1 }, (_, i) => `https://youtu.be/${i}`);

    await expect(
      runBatch(urls, { onItem: () => undefined, delayMs: 0 }),
    ).rejects.toMatchObject({ code: "BATCH_TOO_LARGE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("extracts strictly sequentially and reports items in order", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchMock = vi.fn(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight--;
      return okResponse("dQw4w9WgXcQ");
    });
    vi.stubGlobal("fetch", fetchMock);

    const seen: BatchItem[] = [];
    const results = await runBatch(URLS, {
      onItem: (item) => seen.push(item),
      delayMs: 0,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(maxInFlight).toBe(1); // never parallel — ADR-012 sequential rule
    expect(results.map((item) => item.index)).toEqual([0, 1, 2]);
    expect(results.every((item) => item.status === "ok")).toBe(true);
    expect(seen).toEqual(results); // incremental callbacks match final order
  });

  it("turns a per-item failure into an error while the rest succeed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse("aaaaaaaaaaa"))
      .mockResolvedValueOnce(
        errorResponse(404, "CAPTIONS_UNAVAILABLE", "No captions are available."),
      )
      .mockResolvedValueOnce(okResponse("cccccccccc"));
    vi.stubGlobal("fetch", fetchMock);

    const results = await runBatch(URLS, { onItem: () => undefined, delayMs: 0 });

    expect(results.map((item) => item.status)).toEqual(["ok", "error", "ok"]);
    expect(results[1].error).toBe("No captions are available.");
    expect(results[1].videoId).toBeUndefined();
    expect(results[2].videoId).toBe("cccccccccc");
  });

  it("surfaces a mid-batch rate limit as that item's error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse("aaaaaaaaaaa"))
      .mockResolvedValueOnce(
        errorResponse(429, "RATE_LIMITED", "Too many requests. Please try again shortly."),
      )
      .mockResolvedValueOnce(okResponse("cccccccccc"));
    vi.stubGlobal("fetch", fetchMock);

    const results = await runBatch(URLS, { onItem: () => undefined, delayMs: 0 });

    expect(results[1].status).toBe("error");
    expect(results[1].error).toMatch(/too many requests/i);
    expect(results[2].status).toBe("ok");
  });

  it("stops cleanly when cancelled", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse("aaaaaaaaaaa")));
    let calls = 0;

    const results = await runBatch(URLS, {
      onItem: () => calls++,
      delayMs: 0,
      isCancelled: () => calls >= 1,
    });

    expect(results).toHaveLength(1);
    expect(fetchMockCount()).toBe(1);
  });
});

function fetchMockCount(): number {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
}
