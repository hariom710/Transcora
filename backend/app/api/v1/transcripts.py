from fastapi import APIRouter

from app.schemas.transcript import Transcript, TranscriptRequest
from app.services import transcript_service

router = APIRouter(tags=["transcripts"])


@router.post("/transcripts", response_model=Transcript)
async def create_transcript(payload: TranscriptRequest) -> Transcript:
    return await transcript_service.extract(payload.url, payload.language)
