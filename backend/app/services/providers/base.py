"""Provider contract. Services depend only on this, never on a concrete library."""

from dataclasses import dataclass, field
from typing import Protocol


@dataclass(frozen=True)
class LanguageInfo:
    code: str
    name: str
    is_generated: bool


@dataclass(frozen=True)
class Segment:
    text: str
    start: float
    duration: float


@dataclass(frozen=True)
class RawTranscript:
    language: str
    language_code: str
    is_generated: bool
    segments: list[Segment] = field(default_factory=list)


class CaptionProvider(Protocol):
    def list_languages(self, video_id: str) -> list[LanguageInfo]: ...

    def fetch(self, video_id: str, language: str | None = None) -> RawTranscript: ...
