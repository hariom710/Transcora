from fastapi import APIRouter

from app.api.v1 import transcripts, videos

api_router = APIRouter()
api_router.include_router(videos.router)
api_router.include_router(transcripts.router)
