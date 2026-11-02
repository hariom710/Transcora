import re

from pydantic import BaseModel, Field

LANGUAGE_RE = re.compile(r"^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$")


class TranscriptRequest(BaseModel):
    url: str = Field(min_length=1, max_length=500)
    language: str | None = Field(default=None, pattern=LANGUAGE_RE.pattern)


class TranscriptSegment(BaseModel):
    id: int
    start: float
    duration: float
    text: str


class Transcript(BaseModel):
    video_id: str
    language: str
    language_code: str
    is_generated: bool
    segments: list[TranscriptSegment]


class LanguageInfo(BaseModel):
    code: str
    name: str
    is_generated: bool


class LanguageList(BaseModel):
    video_id: str
    languages: list[LanguageInfo]
