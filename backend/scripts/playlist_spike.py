"""ADR-012 playlist feasibility spike — Innertube enumeration test.

Enumerates video IDs of a public playlist through YouTube's unofficial
Innertube `browse` endpoint (first page), re-validating every returned id
against VIDEO_ID_RE before it would ever be used (SECURITY.md §O).

Run from backend/:  .\\.venv\\Scripts\\python.exe -m scripts.playlist_spike [playlist-url-or-id]
Exit 0 when usable ids come back, 1 when the method is blocked or unusable.
The outcome is recorded in TASKS.md and ADR-012 for the owner's review —
the method is ToS-sensitive and may break without notice (DECISIONS.md).
"""

import json
import re
import sys

import httpx

from app.utils.url_parser import VIDEO_ID_RE

# Public Innertube key shipped in youtube.com's own JS for the WEB client.
INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"
ENDPOINT = f"https://www.youtube.com/youtubei/v1/browse?key={INNERTUBE_KEY}"
DEFAULT_PLAYLIST = "PLFs4vir_WsTwEd-nJgVJCZPNL3HALHHpF"  # public example playlist
PLAYLIST_RE = re.compile(r"(?:[?&]list=|^)([A-Za-z0-9_-]{10,})")


def playlist_id(value: str) -> str:
    match = PLAYLIST_RE.search(value)
    return match.group(1) if match else value.strip()


def collect_video_ids(node: object, found: list[str]) -> None:
    """Depth-first walk collecting every `videoId` string.

    The 2026 web UI moved items out of the classic `playlistVideoRenderer`
    shape (lockupViewModel etc.), so the walk keys on the id field itself —
    every collected value is still re-validated before use.
    """
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "videoId" and isinstance(value, str):
                found.append(value)
            else:
                collect_video_ids(value, found)
    elif isinstance(node, list):
        for item in node:
            collect_video_ids(item, found)


def main() -> int:
    target = playlist_id(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PLAYLIST)
    body = {
        "context": {"client": {"clientName": "WEB", "clientVersion": "2.20260101.00.00"}},
        "browseId": f"VL{target}",
    }
    try:
        response = httpx.post(
            ENDPOINT,
            json=body,
            headers={"Content-Type": "application/json"},
            timeout=20.0,
            follow_redirects=True,
        )
    except httpx.HTTPError as exc:
        print(json.dumps({"playlist": target, "ok": False, "reason": f"transport: {exc}"}))
        return 1

    if response.status_code != 200:
        print(
            json.dumps(
                {"playlist": target, "ok": False, "reason": f"http {response.status_code}"}
            )
        )
        return 1

    raw: list[str] = []
    collect_video_ids(response.json(), raw)
    # Enumeration output is untrusted: validate before any use (SECURITY.md §O).
    valid = [video_id for video_id in raw if VIDEO_ID_RE.match(video_id)]
    invalid = len(raw) - len(valid)
    summary = {
        "playlist": target,
        "ok": len(valid) > 0,
        "unique_valid_ids": len(set(valid)),
        "invalid_ids": invalid,
        "sample": list(dict.fromkeys(valid))[:5],
        "method": "innertube browse (first page, unofficial)",
    }
    print(json.dumps(summary, indent=2))
    return 0 if valid else 1


if __name__ == "__main__":
    raise SystemExit(main())
