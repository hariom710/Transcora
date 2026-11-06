"""Share link endpoints (ADR-011). Handlers are sync (`def`) so FastAPI runs
them in its threadpool — sqlite3 must never block the event loop."""

import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.exceptions import ShareNotFoundError, SharesUnavailableError
from app.core.security import RateLimiter
from app.schemas.share import ShareCreateRequest, ShareCreated, ShareDeleteRequest, ShareDeleted
from app.schemas.transcript import Transcript
from app.services import share_store

logger = logging.getLogger("transcora.shares")

router = APIRouter(tags=["shares"])

# Dedicated stricter creation bucket on top of the global limiter (SECURITY.md §N).
create_hour = RateLimiter(settings.share_rate_per_hour, 3600)
create_day = RateLimiter(settings.share_rate_per_day, 86400)


def _rate_limited(retry_after: int) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "error": {
                "code": "RATE_LIMITED",
                "message": "Share creation limit reached. Please try again later.",
            }
        },
        headers={"Retry-After": str(retry_after)},
    )


@router.post("/shares", response_model=ShareCreated)
def create_share(payload: ShareCreateRequest, request: Request) -> ShareCreated | JSONResponse:
    if not share_store.configured():
        raise SharesUnavailableError()

    client = request.client.host if request.client else "unknown"
    if not create_hour.allow(client):
        return _rate_limited(3600)
    if not create_day.allow(client):
        return _rate_limited(86400)

    body = payload.model_dump_json()
    token, delete_token, expires_at = share_store.create(
        payload.video_id, payload.language_code, body
    )
    # Metadata only — never transcript content, full tokens or delete tokens (§N).
    logger.info(
        "share created",
        extra={
            "video_id": payload.video_id,
            "token_prefix": token[:8],
            "bytes": len(body.encode("utf-8")),
            "expires_at": expires_at.isoformat(),
        },
    )
    origin = settings.frontend_origin.rstrip("/")
    return ShareCreated(
        share_url=f"{origin}/s/{token}",
        delete_token=delete_token,
        expires_at=expires_at.isoformat(),
    )


@router.get("/shares/{token}", response_model=Transcript)
def get_share(token: str) -> Transcript:
    # Disabled, unknown and expired all resolve to the same safe 404.
    if not share_store.configured():
        raise ShareNotFoundError()
    payload = share_store.get(token)
    if payload is None:
        raise ShareNotFoundError()
    return Transcript.model_validate_json(payload)


@router.delete("/shares/{token}", response_model=ShareDeleted)
def delete_share(token: str, payload: ShareDeleteRequest) -> ShareDeleted:
    if not share_store.configured() or not share_store.delete(token, payload.delete_token or ""):
        raise ShareNotFoundError()
    logger.info("share deleted", extra={"token_prefix": token[:8]})
    return ShareDeleted(deleted=True)
