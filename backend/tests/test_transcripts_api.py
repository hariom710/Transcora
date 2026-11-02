import pytest
from fastapi.testclient import TestClient

from app.core.security import RateLimiter
from app.main import app
from app.services.providers.base import RawTranscript, Segment

client = TestClient(app)

VALID_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
RAW = RawTranscript(
    language="English",
    language_code="en",
    is_generated=True,
    segments=[Segment(text="Hello world.", start=0.0, duration=2.5)],
)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_transcript_happy_path(use_provider) -> None:
    use_provider(raw=RAW)

    response = client.post("/api/v1/transcripts", json={"url": VALID_URL, "language": "en"})

    assert response.status_code == 200
    body = response.json()
    assert body["video_id"] == "dQw4w9WgXcQ"
    assert body["is_generated"] is True
    assert body["segments"][0] == {
        "id": 1,
        "start": 0.0,
        "duration": 2.5,
        "text": "Hello world.",
    }


def test_invalid_url_returns_structured_error(use_provider) -> None:
    provider = use_provider(raw=RAW)

    response = client.post("/api/v1/transcripts", json={"url": "https://evil.com/x"})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_URL"
    assert provider.calls == []


def test_missing_url_returns_structured_error() -> None:
    response = client.post("/api/v1/transcripts", json={})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_oversized_body_rejected() -> None:
    response = client.post("/api/v1/transcripts", json={"url": "x" * 20_000})
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_rate_limit(monkeypatch: pytest.MonkeyPatch, use_provider) -> None:
    use_provider(raw=RAW)
    monkeypatch.setattr("app.main.rate_limiter", RateLimiter(2, 60))

    first = client.post("/api/v1/transcripts", json={"url": VALID_URL})
    second = client.post("/api/v1/transcripts", json={"url": VALID_URL})
    third = client.post("/api/v1/transcripts", json={"url": VALID_URL})

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
    assert third.headers["Retry-After"] == "60"
    assert third.json()["error"]["code"] == "RATE_LIMITED"


def test_cors_rejects_unknown_origin() -> None:
    response = client.post(
        "/api/v1/transcripts",
        json={"url": VALID_URL},
        headers={"Origin": "https://evil.example"},
    )
    assert "access-control-allow-origin" not in response.headers


def test_languages_endpoint(use_provider) -> None:
    use_provider(raw=RAW)

    response = client.get("/api/v1/videos/dQw4w9WgXcQ/languages")

    assert response.status_code == 200
    assert response.json()["languages"][0]["code"] == "en"


def test_languages_rejects_bad_video_id() -> None:
    response = client.get("/api/v1/videos/not-a-valid-id/languages")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_URL"
