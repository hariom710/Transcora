import asyncio

import pytest

from app.core.exceptions import CaptionsUnavailableError, InvalidUrlError
from app.services import transcript_service
from app.services.providers.base import RawTranscript, Segment

VALID_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
RAW = RawTranscript(
    language="English",
    language_code="en",
    is_generated=True,
    segments=[
        Segment(text="  Welcome   to today's  tutorial. ", start=0.0, duration=3.5),
        Segment(text="   \n\t ", start=3.5, duration=4.2),  # whitespace-only: dropped
        Segment(text="Second line.", start=7.7, duration=2.0),
    ],
)


def test_normalizes_segments(use_provider) -> None:
    provider = use_provider(raw=RAW)

    result = asyncio.run(transcript_service.extract(VALID_URL, "en"))

    assert result.video_id == "dQw4w9WgXcQ"
    assert result.language_code == "en"
    assert result.is_generated is True
    assert [segment.id for segment in result.segments] == [1, 2]
    assert result.segments[0].text == "Welcome to today's tutorial."
    assert result.segments[0].start == 0.0
    assert result.segments[0].duration == 3.5
    assert provider.calls == [("dQw4w9WgXcQ", "en")]


def test_invalid_url_never_reaches_provider(use_provider) -> None:
    provider = use_provider(raw=RawTranscript("English", "en", True, []))

    with pytest.raises(InvalidUrlError):
        asyncio.run(transcript_service.extract("https://evil.com/watch?v=dQw4w9WgXcQ"))

    assert provider.calls == []


def test_provider_error_propagates(use_provider) -> None:
    use_provider(error=CaptionsUnavailableError())

    with pytest.raises(CaptionsUnavailableError):
        asyncio.run(transcript_service.extract(VALID_URL))


def test_lists_languages(use_provider) -> None:
    use_provider()

    result = asyncio.run(transcript_service.languages("dQw4w9WgXcQ"))

    assert result.video_id == "dQw4w9WgXcQ"
    assert result.languages[0].code == "en"
