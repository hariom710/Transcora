function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

/**
 * Rounding to whole milliseconds first absorbs float noise (3.5 + 4.2) and
 * guarantees the millisecond field can never carry over into 1000.
 */
function toMilliseconds(seconds: number): number {
  return Math.max(0, Math.round(seconds * 1000));
}

/** 00:00 · 1:02:03 — compact clock for the transcript list. */
export function formatClock(seconds: number): string {
  const total = Math.floor(toMilliseconds(seconds) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
}

function fullTime(seconds: number): [string, string, string, string] {
  const totalMs = toMilliseconds(seconds);
  const total = Math.floor(totalMs / 1000);
  return [
    pad(Math.floor(total / 3600)),
    pad(Math.floor((total % 3600) / 60)),
    pad(total % 60),
    pad(totalMs % 1000, 3),
  ];
}

/** 00:00:03,500 — SRT uses comma decimals. */
export function formatSrtTime(seconds: number): string {
  const [h, m, s, ms] = fullTime(seconds);
  return `${h}:${m}:${s},${ms}`;
}

/** 00:00:03.500 — WebVTT uses dot decimals. */
export function formatVttTime(seconds: number): string {
  const [h, m, s, ms] = fullTime(seconds);
  return `${h}:${m}:${s}.${ms}`;
}
