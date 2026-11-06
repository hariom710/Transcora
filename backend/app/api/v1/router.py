from fastapi import APIRouter

from app.api.v1 import shares, transcripts, videos

api_router = APIRouter()
api_router.include_router(videos.router)
api_router.include_router(transcripts.router)
api_router.include_router(shares.router)
