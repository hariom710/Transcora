from pydantic import BaseModel, ConfigDict, Field

from app.schemas.transcript import LANGUAGE_RE, Transcript, TranscriptSegment
from app.utils.url_parser import VIDEO_ID_RE

# SECURITY.md §E field caps; the 1 MiB byte cap is enforced in the middleware (§N).
MAX_SEGMENTS = 20_000
MAX_TEXT_CHARS = 10_000


class ShareSegment(TranscriptSegment):
    text: str = Field(max_length=MAX_TEXT_CHARS)


class ShareCreateRequest(Transcript):
    """A share payload must have the shape of a real extracted transcript —
    the endpoint is not a free-form dump (SECURITY.md §N)."""

    model_config = ConfigDict(extra="ignore")

    video_id: str = Field(pattern=VIDEO_ID_RE.pattern)
    language_code: str = Field(pattern=LANGUAGE_RE.pattern)
    segments: list[ShareSegment] = Field(max_length=MAX_SEGMENTS)


class ShareCreated(BaseModel):
    share_url: str
    delete_token: str
    expires_at: str


class ShareDeleteRequest(BaseModel):
    delete_token: str | None = None


class ShareDeleted(BaseModel):
    deleted: bool
