"""Share link tests — TESTING.md §U (ADR-011)."""

import hashlib
import json
import logging
import sqlite3
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import RateLimiter
from app.main import app
from app.schemas.share import MAX_SEGMENTS, MAX_TEXT_CHARS
from app.services import share_store

client = TestClient(app)


@pytest.fixture(autouse=True)
def generous_global_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    """Share tests issue many requests; keep the shared per-IP budgets out of it.
    The flood test tightens the creation bucket again itself."""
    monkeypatch.setattr("app.main.rate_limiter", RateLimiter(100_000, 60))
    monkeypatch.setattr("app.api.v1.shares.create_hour", RateLimiter(100_000, 3600))
    monkeypatch.setattr("app.api.v1.shares.create_day", RateLimiter(100_000, 86400))


def make_payload(text: str = "Hello — wörld 🎵") -> dict:
    return {
        "video_id": "dQw4w9WgXcQ",
        "language": "English",
        "language_code": "en",
        "is_generated": True,
        "segments": [
            {"id": 1, "start": 0.0, "duration": 2.5, "text": text},
            {"id": 2, "start": 2.5, "duration": 3.0, "text": "Second line."},
        ],
    }


def create_share(payload: dict | None = None):
    response = client.post("/api/v1/shares", json=payload or make_payload())
    assert response.status_code == 200, response.text
    return response.json()


def token_from(share: dict) -> str:
    return share["share_url"].rsplit("/", 1)[-1]


def test_create_and_fetch_roundtrip(share_db) -> None:
    payload = make_payload()
    share = create_share(payload)

    assert share["share_url"].startswith("http://localhost:3000/s/")
    assert share["delete_token"]
    assert share["expires_at"]

    fetched = client.get(f"/api/v1/shares/{token_from(share)}")
    assert fetched.status_code == 200
    assert fetched.json() == payload  # byte-identical round trip, unicode preserved


def test_tokens_unique_and_only_hashes_stored(share_db) -> None:
    shares = [create_share() for _ in range(5)]
    tokens = [token_from(s) for s in shares]
    delete_tokens = [s["delete_token"] for s in shares]

    assert len(set(tokens)) == 5
    assert len(set(delete_tokens)) == 5
    assert all(len(t) >= 43 for t in tokens)  # token_urlsafe(32) → 43 chars, 256 bits

    with sqlite3.connect(share_db) as conn:
        rows = conn.execute("SELECT token_hash, delete_hash, payload FROM shares").fetchall()
    assert len(rows) == 5
    for token, delete_token, (token_hash, delete_hash, payload) in zip(tokens, delete_tokens, rows):
        # A database dump yields no working links (SECURITY.md §N).
        assert token not in payload and delete_token not in payload
        assert token_hash == hashlib.sha256(token.encode()).hexdigest()
        assert delete_hash == hashlib.sha256(delete_token.encode()).hexdigest()


def test_unknown_and_expired_token_identical_404(share_db) -> None:
    share = create_share()
    unknown = client.get("/api/v1/shares/definitely-not-a-real-token")
    assert unknown.status_code == 404

    with sqlite3.connect(share_db) as conn:  # force the share past its expiry
        conn.execute(
            "UPDATE shares SET expires_at = ?",
            (datetime.now(UTC).isoformat(),),
        )
        conn.commit()

    expired = client.get(f"/api/v1/shares/{token_from(share)}")
    assert expired.status_code == 404
    # Identical bodies — no enumeration oracle.
    assert expired.json() == unknown.json()


def test_delete_requires_correct_token_and_removes_row(share_db) -> None:
    share = create_share()
    token = token_from(share)

    missing = client.request("DELETE", f"/api/v1/shares/{token}", json={})
    assert missing.status_code == 404

    wrong = client.request("DELETE", f"/api/v1/shares/{token}", json={"delete_token": "nope"})
    assert wrong.status_code == 404
    assert client.get(f"/api/v1/shares/{token}").status_code == 200  # nothing removed

    right = client.request(
        "DELETE", f"/api/v1/shares/{token}", json={"delete_token": share["delete_token"]}
    )
    assert right.status_code == 200
    assert right.json() == {"deleted": True}
    assert client.get(f"/api/v1/shares/{token}").status_code == 404
    with sqlite3.connect(share_db) as conn:
        assert conn.execute("SELECT COUNT(*) FROM shares").fetchone()[0] == 0


def test_oversized_body_rejected_and_nothing_stored(share_db) -> None:
    share_store.get("warmup")  # create the schema so a strict empty-table check works
    response = client.post(
        "/api/v1/shares",
        data='{"segments": "' + "x" * (settings.share_max_body_bytes + 1_000) + '"}',
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"
    with sqlite3.connect(share_db) as conn:
        assert conn.execute("SELECT COUNT(*) FROM shares").fetchone()[0] == 0


def test_field_caps_rejected(share_db) -> None:
    too_long = make_payload(text="x" * (MAX_TEXT_CHARS + 1))
    assert client.post("/api/v1/shares", json=too_long).status_code == 400

    many = make_payload()
    many["segments"] = [
        {"id": i, "start": 0.0, "duration": 1.0, "text": "x"} for i in range(MAX_SEGMENTS + 1)
    ]
    assert client.post("/api/v1/shares", json=many).status_code == 400


def test_creation_flood_429_with_retry_after(share_db, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.api.v1.shares.create_hour", RateLimiter(2, 3600))

    assert create_share()["share_url"]
    assert create_share()["share_url"]
    third = client.post("/api/v1/shares", json=make_payload())

    assert third.status_code == 429
    assert third.headers["Retry-After"] == "3600"
    assert third.json()["error"]["code"] == "RATE_LIMITED"


def test_logging_carries_metadata_only(share_db, caplog: pytest.LogCaptureFixture) -> None:
    marker = "super-secret-transcript-content"
    with caplog.at_level(logging.INFO, logger="transcora.shares"):
        share = create_share(make_payload(text=marker))
    token = token_from(share)

    for record in caplog.records:
        message = record.getMessage()
        assert marker not in message
        assert token not in message
        assert share["delete_token"] not in message

    created = [r for r in caplog.records if r.getMessage() == "share created"]
    assert created and created[0].video_id == "dQw4w9WgXcQ"
    assert len(created[0].token_prefix) <= 8  # truncated prefix only (§N)
    assert created[0].bytes > 0


def test_expired_rows_purged_by_lazy_sweep(share_db) -> None:
    first = create_share()
    with sqlite3.connect(share_db) as conn:
        conn.execute("UPDATE shares SET expires_at = ?", (datetime.now(UTC).isoformat(),))
        conn.commit()

    create_share()  # any creation sweeps expired rows

    with sqlite3.connect(share_db) as conn:
        rows = conn.execute("SELECT token_hash FROM shares").fetchall()
    assert len(rows) == 1
    assert client.get(f"/api/v1/shares/{token_from(first)}").status_code == 404


def test_shares_disabled_without_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "database_url", "")

    created = client.post("/api/v1/shares", json=make_payload())
    assert created.status_code == 503
    assert created.json()["error"]["code"] == "SHARES_UNAVAILABLE"
    assert client.get("/api/v1/shares/anything").status_code == 404
    assert (
        client.request("DELETE", "/api/v1/shares/anything", json={"delete_token": "x"}).status_code
        == 404
    )


def test_json_content_type_shape(share_db) -> None:
    """Stored payload must stay a valid Transcript JSON document."""
    share = create_share()
    token = token_from(share)
    with sqlite3.connect(share_db) as conn:
        stored = conn.execute("SELECT payload FROM shares").fetchone()[0]
    parsed = json.loads(stored)
    assert parsed["segments"][0]["text"].startswith("Hello")
    assert client.get(f"/api/v1/shares/{token}").headers["content-type"].startswith(
        "application/json"
    )
