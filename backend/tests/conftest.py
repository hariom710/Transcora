from collections.abc import Callable
from pathlib import Path

import pytest

from app.core.config import settings
from app.services import transcript_service
from app.services.providers.base import LanguageInfo, RawTranscript


class FakeProvider:
    def __init__(self, raw: RawTranscript | None = None, error: Exception | None = None) -> None:
        self.raw = raw
        self.error = error
        self.calls: list[tuple[str, str | None]] = []

    def fetch(self, video_id: str, language: str | None = None) -> RawTranscript:
        self.calls.append((video_id, language))
        if self.error:
            raise self.error
        return self.raw

    def list_languages(self, video_id: str) -> list[LanguageInfo]:
        return [LanguageInfo(code="en", name="English", is_generated=True)]


@pytest.fixture
def use_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> Callable[..., FakeProvider]:
    """Swap the real caption provider for a fake and return it for assertions."""

    def _use(raw: RawTranscript | None = None, error: Exception | None = None) -> FakeProvider:
        provider = FakeProvider(raw=raw, error=error)
        monkeypatch.setattr(transcript_service, "provider", provider)
        return provider

    return _use


@pytest.fixture
def share_db(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """Points the share store at a throwaway SQLite file for one test."""
    db_path = tmp_path / "shares.db"
    monkeypatch.setattr(settings, "database_url", f"sqlite:///{db_path}")
    return db_path
