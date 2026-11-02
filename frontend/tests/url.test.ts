import { describe, expect, it } from "vitest";

import { isVideoId, parseVideoId } from "@/lib/url";

const ID = "dQw4w9WgXcQ";

const VALID = [
  `https://www.youtube.com/watch?v=${ID}`,
  `https://youtu.be/${ID}`,
  `https://www.youtube.com/embed/${ID}`,
  `https://www.youtube.com/shorts/${ID}`,
  `www.youtube.com/watch?v=${ID}`,
  `https://www.youtube.com/watch?v=${ID}&t=42s&list=PL123`,
  `https://m.youtube.com/watch?v=${ID}`,
];

const INVALID = [
  "",
  "   ",
  "https://evil.com/watch?v=dQw4w9WgXcQ",
  "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
  "https://notyoutube.com/watch?v=dQw4w9WgXcQ",
  "https://www.youtube.com/watch",
  "https://www.youtube.com/watch?v=short",
  "https://www.youtube.com/watch?v=dQw4w9WgXc!",
  "https://youtu.be/",
  "https://www.youtube.com/playlist?list=PL123",
  "javascript:alert(1)",
  "file:///etc/passwd",
];

describe("parseVideoId", () => {
  it.each(VALID)("extracts the id from %s", (url) => {
    expect(parseVideoId(url)).toBe(ID);
  });

  it.each(INVALID)("rejects %j", (url) => {
    expect(parseVideoId(url)).toBeNull();
  });
});

describe("isVideoId", () => {
  it("accepts an 11 character YouTube id", () => {
    expect(isVideoId(ID)).toBe(true);
  });

  it("rejects malformed ids", () => {
    expect(isVideoId("too-short")).toBe(false);
    expect(isVideoId(`${ID} extra`)).toBe(false);
    expect(isVideoId("")).toBe(false);
  });
});
