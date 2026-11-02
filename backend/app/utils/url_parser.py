"""Strict YouTube URL validation and video-ID extraction (SECURITY.md §B).

The video ID is the only value that ever leaves this module. Callers never pass
a user-supplied URL to an outbound request, which is what makes SSRF impossible.
"""

import re
from urllib.parse import parse_qs, urlparse

from app.core.exceptions import InvalidUrlError

ALLOWED_HOSTS = frozenset(
    {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}
)
VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


def is_video_id(value: str) -> bool:
    return bool(VIDEO_ID_RE.match(value))


def parse_video_id(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        raise InvalidUrlError()
    if "://" not in raw:
        raw = f"https://{raw}"

    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"}:
        raise InvalidUrlError()

    host = (parsed.hostname or "").lower()
    if host not in ALLOWED_HOSTS:
        raise InvalidUrlError()

    candidate: str | None = None
    if host == "youtu.be":
        candidate = parsed.path.lstrip("/").split("/")[0]
    else:
        parts = [part for part in parsed.path.split("/") if part]
        if parts and parts[0] == "watch":
            candidate = (parse_qs(parsed.query).get("v") or [None])[0]
        elif len(parts) >= 2 and parts[0] in {"embed", "shorts"}:
            candidate = parts[1]

    if not candidate or not is_video_id(candidate):
        raise InvalidUrlError()
    return candidate
