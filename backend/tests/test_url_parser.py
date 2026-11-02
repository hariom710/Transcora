import pytest

from app.core.exceptions import InvalidUrlError
from app.utils.url_parser import is_video_id, parse_video_id

VALID_ID = "dQw4w9WgXcQ"

VALID_URLS = [
    f"https://www.youtube.com/watch?v={VALID_ID}",
    f"https://youtu.be/{VALID_ID}",
    f"https://www.youtube.com/embed/{VALID_ID}",
    f"https://www.youtube.com/shorts/{VALID_ID}",
    # scheme-less paste is accepted
    f"www.youtube.com/watch?v={VALID_ID}",
    # extra query params and timestamps are ignored
    f"https://www.youtube.com/watch?v={VALID_ID}&t=42s&list=PL123",
    f"https://m.youtube.com/watch?v={VALID_ID}",
]


@pytest.mark.parametrize("url", VALID_URLS)
def test_valid_urls_extract_the_same_id(url: str) -> None:
    assert parse_video_id(url) == VALID_ID


@pytest.mark.parametrize(
    "url",
    [
        "",
        "   ",
        "https://evil.com/watch?v=dQw4w9WgXcQ",
        "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
        "https://notyoutube.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com/watch",  # no v param
        "https://www.youtube.com/watch?v=short",  # bad id length
        "https://www.youtube.com/watch?v=dQw4w9WgXc!",  # bad id chars
        "https://youtu.be/",
        "https://www.youtube.com/playlist?list=PL123",
        "javascript:alert(1)",
        "file:///etc/passwd",
        "https://www.youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
    ],
)
def test_invalid_urls_are_rejected(url: str) -> None:
    with pytest.raises(InvalidUrlError):
        parse_video_id(url)


def test_video_id_pattern() -> None:
    assert is_video_id(VALID_ID)
    assert not is_video_id("too-short")
    assert not is_video_id("dQw4w9WgXcQ extra")
    assert not is_video_id("")
