from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import AppError
from app.core.security import RateLimiter

app = FastAPI(title="Free YouTube Transcript Generator", version="1.0.0")

# Explicit origin allowlist, no wildcard, no credentials (SECURITY.md §D).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)

rate_limiter = RateLimiter(settings.rate_limit_requests, settings.rate_limit_window_seconds)


def _error(status_code: int, code: str, message: str, headers: dict | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}},
        headers=headers,
    )


@app.middleware("http")
async def request_guard(request: Request, call_next):
    client = request.client.host if request.client else "unknown"
    # OPTIONS preflights are browser-generated overhead, not user traffic:
    # counting them doubles the cost of every JSON POST, and a preflight 429
    # carries no CORS headers so the browser reports a network error instead
    # of the rate-limit message.
    if request.method != "OPTIONS" and not rate_limiter.allow(client):
        return _error(
            429,
            "RATE_LIMITED",
            "Too many requests. Please try again shortly.",
            headers={"Retry-After": str(settings.rate_limit_window_seconds)},
        )

    length = request.headers.get("content-length")
    # Share creation carries a transcript, so it gets the larger §N cap (1 MiB);
    # everything else keeps the strict default.
    limit = (
        settings.share_max_body_bytes
        if request.method == "POST" and request.url.path == "/api/v1/shares"
        else settings.max_body_bytes
    )
    if length and length.isdigit() and int(length) > limit:
        return _error(413, "PAYLOAD_TOO_LARGE", "Request body is too large.")

    return await call_next(request)


@app.exception_handler(AppError)
async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
    return _error(exc.status_code, exc.code, exc.message)


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    return _error(400, "INVALID_REQUEST", "The request was not valid.")


@app.exception_handler(Exception)
async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
    # Internals stay out of the response body (SECURITY.md §D).
    return _error(500, "INTERNAL_ERROR", "Something went wrong. Please try again.")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_router, prefix="/api/v1")
