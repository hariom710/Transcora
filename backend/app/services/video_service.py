import httpx

from app.schemas.video import Video
from app.utils.url_parser import parse_video_id

OEMBED_ENDPOINT = "https://www.youtube.com/oembed"
TIMEOUT_SECONDS = 5.0


async def _oembed(video_url: str) -> dict:
    # Host is fixed and the ID was already validated, so this cannot be turned
    # into SSRF. Redirects are not followed for the same reason (SECURITY.md §C).
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS, follow_redirects=False) as client:
        response = await client.get(
            OEMBED_ENDPOINT, params={"url": video_url, "format": "json"}
        )
    if response.status_code != 200:
        return {}
    data = response.json()
    return {
        "title": data.get("title"),
        "channel": data.get("author_name"),
        "thumbnail_url": data.get("thumbnail_url"),
    }


async def inspect(url: str) -> Video:
    """Best-effort metadata. Missing fields never block a transcript."""
    video_id = parse_video_id(url)
    video = Video(id=video_id, url=f"https://www.youtube.com/watch?v={video_id}")
    try:
        meta = await _oembed(video.url)
    except (httpx.HTTPError, ValueError):
        meta = {}

    video.title = meta.get("title")
    video.channel = meta.get("channel")
    video.thumbnail_url = meta.get("thumbnail_url")
    # oEmbed exposes no duration, so it stays unset rather than guessed.
    return video
