/**
 * Client-side mirror of backend/app/utils/url_parser.py.
 *
 * SECURITY.md §B requires validation on both sides: this copy is UX only, the
 * server remains the enforcement point. The two implementations must stay in step.
 */

const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function isVideoId(value: string): boolean {
  return VIDEO_ID_RE.test(value);
}

/** Returns the video ID, or null when the URL is not a supported YouTube link. */
export function parseVideoId(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return null;

  let candidate: string | null = null;
  if (host === "youtu.be") {
    candidate = parsed.pathname.replace(/^\/+/, "").split("/")[0] || null;
  } else {
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch") {
      candidate = parsed.searchParams.get("v");
    } else if ((parts[0] === "embed" || parts[0] === "shorts") && parts[1]) {
      candidate = parts[1];
    }
  }

  return candidate && isVideoId(candidate) ? candidate : null;
}
