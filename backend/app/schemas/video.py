from pydantic import BaseModel, Field


class VideoInspectRequest(BaseModel):
    url: str = Field(min_length=1, max_length=500)


class Video(BaseModel):
    id: str
    url: str
    title: str | None = None
    channel: str | None = None
    thumbnail_url: str | None = None
    duration: float | None = None
