import asyncio

import httpx
import pytest

from app.core.exceptions import InvalidUrlError
from app.services import video_service

VALID_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
METADATA = {"title": "Sample Video", "channel": "Sample Channel", "thumbnail_url": "https://i.ytimg.com/vi/x/hq.jpg"}


def test_inspect_returns_metadata(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_oembed(video_url: str) -> dict:
        assert video_url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        return METADATA

    monkeypatch.setattr(video_service, "_oembed", fake_oembed)

    video = asyncio.run(video_service.inspect(VALID_URL))

    assert video.id == "dQw4w9WgXcQ"
    assert video.title == "Sample Video"
    assert video.channel == "Sample Channel"
    assert video.duration is None  # oEmbed provides no duration


def test_inspect_survives_metadata_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    async def broken(video_url: str) -> dict:
        raise httpx.ConnectError("boom")

    monkeypatch.setattr(video_service, "_oembed", broken)

    video = asyncio.run(video_service.inspect(VALID_URL))

    assert video.id == "dQw4w9WgXcQ"
    assert video.title is None
    assert video.channel is None


def test_inspect_rejects_non_youtube_url() -> None:
    with pytest.raises(InvalidUrlError):
        asyncio.run(video_service.inspect("https://evil.com/watch?v=dQw4w9WgXcQ"))
