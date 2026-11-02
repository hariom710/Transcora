from fastapi import APIRouter

from app.core.exceptions import InvalidUrlError
from app.schemas.transcript import LanguageList
from app.schemas.video import Video, VideoInspectRequest
from app.services import transcript_service, video_service
from app.utils.url_parser import is_video_id

router = APIRouter(tags=["videos"])


@router.post("/videos/inspect", response_model=Video)
async def inspect_video(payload: VideoInspectRequest) -> Video:
    return await video_service.inspect(payload.url)


@router.get("/videos/{video_id}/languages", response_model=LanguageList)
async def list_languages(video_id: str) -> LanguageList:
    if not is_video_id(video_id):
        raise InvalidUrlError()
    return await transcript_service.languages(video_id)
