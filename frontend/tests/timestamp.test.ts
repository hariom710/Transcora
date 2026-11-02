import { describe, expect, it } from "vitest";

import { formatClock, formatSrtTime, formatVttTime } from "@/lib/timestamp";

describe("formatClock", () => {
  it("formats minutes and seconds", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(5)).toBe("00:05");
    expect(formatClock(93)).toBe("01:33");
  });

  it("adds an hour component when needed", () => {
    expect(formatClock(3723)).toBe("1:02:03");
  });
});

describe("formatSrtTime", () => {
  it("matches the SRT format from the specification", () => {
    expect(formatSrtTime(0)).toBe("00:00:00,000");
    expect(formatSrtTime(3.5)).toBe("00:00:03,500");
    expect(formatSrtTime(7.7)).toBe("00:00:07,700");
  });

  it("never rolls the millisecond field over", () => {
    expect(formatSrtTime(59.9999)).toBe("00:01:00,000");
  });

  it("absorbs float accumulation", () => {
    expect(formatSrtTime(3.5 + 4.2)).toBe("00:00:07,700");
  });
});

describe("formatVttTime", () => {
  it("uses dot decimals", () => {
    expect(formatVttTime(0)).toBe("00:00:00.000");
    expect(formatVttTime(3.5)).toBe("00:00:03.500");
  });

  it("never rolls the millisecond field over", () => {
    expect(formatVttTime(59.9999)).toBe("00:01:00.000");
  });
});
