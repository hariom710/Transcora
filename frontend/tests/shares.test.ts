import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiFailure, createShare, deleteShare, fetchShare } from "@/services/api";
import type { Transcript } from "@/types";

const TRANSCRIPT: Transcript = {
  video_id: "dQw4w9WgXcQ",
  language: "English",
  language_code: "en",
  is_generated: true,
  segments: [{ id: 1, start: 0, duration: 2, text: "Hello." }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createShare consent gate (SECURITY.md §N)", () => {
  it("refuses without acknowledgment and never touches the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(createShare(TRANSCRIPT, false)).rejects.toMatchObject({
      code: "CONSENT_REQUIRED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the transcript only when acknowledged", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        share_url: "http://localhost:3000/s/abc",
        delete_token: "del",
        expires_at: "2026-12-05T00:00:00+00:00",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const share = await createShare(TRANSCRIPT, true);
    expect(share.share_url).toContain("/s/abc");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/shares");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(TRANSCRIPT);
  });

  it("propagates backend errors as ApiFailure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          error: { code: "RATE_LIMITED", message: "Share creation limit reached." },
        }),
      }),
    );

    await expect(createShare(TRANSCRIPT, true)).rejects.toBeInstanceOf(ApiFailure);
    await expect(createShare(TRANSCRIPT, true)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });
});

describe("share fetch and delete", () => {
  it("requests and deletes by token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => TRANSCRIPT })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ deleted: true }) });
    vi.stubGlobal("fetch", fetchMock);

    const transcript = await fetchShare("tok/en");
    expect(transcript).toEqual(TRANSCRIPT);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v1/shares/tok%2Fen");

    await deleteShare("abc", "secret-delete");
    const [, init] = fetchMock.mock.calls[1];
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({ delete_token: "secret-delete" });
  });
});
