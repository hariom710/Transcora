# TESTING.md — Testing and Verification

How correctness is proven. Progress: [TASKS.md](TASKS.md). Rules: [AGENTS.md](../AGENTS.md) §F.

> **Status (2026-11-03):** Version 1 suites exist and are green — 37 backend tests (Pytest) and 48 frontend tests (Vitest), plus clean `eslint`, `tsc --noEmit` and `next build` (recorded in [TASKS.md](TASKS.md) Phase 9). Playwright is not installed; E2E flows were verified manually in a browser. Sections §U–§V specify tests for Version 2 features that do not exist yet. **Never record a result here that was not actually observed.**

## A. Testing philosophy

- Tests prove behaviour, not implementation details.
- External YouTube calls are **mocked** in automated tests — never depend on live YouTube for CI.
- Tests run at the lowest level that can catch the bug: unit → integration → API → E2E.
- Run targeted tests first; the full suite before declaring a task done.
- A test that cannot fail is not a test.

## B. Backend unit testing (Pytest)

Pure functions and service logic: URL parsing, timestamp conversion, normalization, error mapping.

```
pytest tests/test_url_parser.py -q
pytest tests/test_transcript_service.py -q
```

Status: green — both files are part of the 37-test backend suite.

## C. Backend integration testing

Service + mocked provider, verifying orchestration, timeout handling and error taxonomy.

Status: green — the provider is mocked at the boundary via `conftest.py` fixtures (§H).

## D. API testing

FastAPI `TestClient` (or httpx ASGI transport) against `/health`, `/api/v1/videos/inspect`, `/api/v1/videos/{id}/languages`, `/api/v1/transcripts`.

Assert status codes, response shape, and the unified error contract.

Status: green — `tests/test_videos_api.py` and `tests/test_transcripts_api.py` use FastAPI `TestClient` (rate limiting covered by an explicit test).

## E. Frontend testing

Component behaviour: search matching, editing, counts, export button states, loading/empty/error rendering.

Status: green for pure logic — 56 Vitest tests over URL parsing, timestamps, search, export builders (incl. plain-text clipboard variant) and playback sync (`findActiveSegment`) (`frontend/tests/`). Editing, counts and loading/empty/error rendering have no automated component tests; they are verified manually in the browser. The T1 workspace (player, seek, follow-playback highlight, font size, copy menu, keyboard shortcuts) was verified manually in the browser — Playwright coverage is planned for T6.

## F. TypeScript validation

```
npx tsc --noEmit
npm run lint
```

Strict mode must produce zero errors. Status: green — `eslint` clean and zero `tsc` errors on every run.

## G. End-to-end testing (Playwright)

Happy path: paste URL → transcript rendered → search finds a match → export SRT downloads.
Error paths: invalid URL, caption-less video, backend unavailable.

Status: Playwright **not installed** — the flows above were verified manually in a browser (TASKS.md Phase 9); installation and a real suite are planned for tranche T6.

## H. Mocking external YouTube services

- Mock at the **provider boundary** (`youtube_provider.py`), not inside the normalizer, so real provider response shapes are exercised.
- Fixtures: manual captions, auto captions, multiple languages, translated track, no captions, private video, blocked request, malformed provider payload.
- One optional, explicitly-skipped live smoke test may exist for manual runs; it must never run in CI.

## I. URL validation tests

| Case | Expected |
|---|---|
| `watch?v=ID` | correct ID |
| `youtu.be/ID` | correct ID |
| `/embed/ID` | correct ID |
| `/shorts/ID` | correct ID |
| `evil.com/watch?v=ID` | rejected |
| missing / malformed ID | rejected |
| non-YouTube scheme (`file:`, `javascript:`) | rejected |
| extra query params, playlists, timestamps | handled per spec |

## J. Caption extraction tests

Manual captions retrieved · auto captions retrieved · caption-less video → clear error · private/restricted video → clear error · timeout → safe error · provider failure → safe error, no stack trace leaked.

## K. Language selection tests

Languages listed from fixture · default selection correct · requested language honoured · unavailable language → structured error.

## L. Transcript normalization tests

Provider payload → common `Transcript` shape · segment ids sequential · `start`/`duration` are numbers · text preserved (including unicode) · empty caption list handled.

## M. Timestamp tests

Provider millisecond/offset formats → seconds · monotonic non-negative starts · boundary values (0, sub-second, > 1 hour) · SRT/VTT time formatting (`HH:MM:SS,mmm` / `HH:MM:SS.mmm`) exact.

## N. Export tests

| Format | Assertions |
|---|---|
| TXT | plain text, no markup, timestamps per spec |
| Clipboard | with timestamps (`toTxt`) and without (`toPlainText`) |
| SRT | valid numbering, arrow syntax, comma decimals, blank-line separation |
| VTT | `WEBVTT` header, dot decimals, cue syntax |
| Markdown | structure sane, timestamps preserved |
| PDF | file opens, text readable, non-empty |
| All | user edits reflected; original timestamps preserved |

Validate SRT/VTT against their format rules using fixture transcripts, including the example in [PROJECT.md](PROJECT.md).

## O. Large transcript performance tests

Generate a fixture with thousands of segments. Assert: search returns within budget, rendering does not freeze the main thread, scrolling stays responsive. If profiling shows a problem, virtualize (Phase 6/7).

## P. Error-handling tests

Every error path returns the unified shape `{ "error": { "code", "message" } }` with an appropriate status. No internal details, paths or stack traces in responses.

## Q. Security tests

SSRF: attempts to submit non-YouTube URLs never cause an outbound request. Allowlist enforced server-side, not only in the UI. Rate limiting returns 429 under load. Request size limits enforced. CORS rejects unknown origins. Transcript text renders as text — never injected HTML.

Version 2 adds, once implemented: share token entropy and expiry behaviour, share creation rate/size limits, log assertions (no content, no full tokens), and batch cap/rate-budget tests — see §U–§V.

See [SECURITY.md](SECURITY.md) §B–§E, §L, §N–§O.

## R. Gemini integration tests (Phase 10)

| Case | Expected |
|---|---|
| Missing API key | AI controls disabled, app fully usable |
| Invalid API key | clear message, no crash |
| Quota exceeded | clear message, retry guidance |
| Request failure / timeout | safe error, transcript untouched |
| Very long transcript | graceful handling, no silent truncation without notice |
| Model response malformed | validated before display |

Key never appears in logs or in any request to our backend.

## S. Production release checklist

- [ ] All suites green in CI
- [ ] Full Playwright E2E green against a production build
- [ ] Real transcript extracted **from the deployed environment**
- [ ] Rate limiting, CORS and timeouts active in production
- [ ] No secrets in the bundle or repository
- [ ] Light and dark themes verified
- [ ] Mobile viewport verified
- [ ] Error states verified with backend stopped
- [ ] Dependency audit clean of high-severity issues
- [ ] Share lifecycle (create → read → expire → delete) verified in production (ADR-011)
- [ ] [SECURITY.md](SECURITY.md) §L checklist signed off

## T. Windows development commands

Aligned with this environment: **Windows 10/11, Node 22, Python 3.13, Git**. No Docker.

| Purpose | Command | Status |
|---|---|---|
| Frontend dev | `npm run dev` | runnable |
| Type check | `npx tsc --noEmit` | green |
| Lint | `npm run lint` | green |
| Frontend tests | `npm test` | green (48) |
| Frontend build | `npm run build` | green |
| Backend dev | `uvicorn app.main:app --reload` | runnable |
| Backend tests | `pytest -q` | green (37) |
| Targeted test | `pytest tests/test_url_parser.py -q` | runnable |
| E2E | `npx playwright test` | not installed — planned for T6 |

These match the project's actual configuration. Update this table if the configuration differs — document only commands the real configuration supports.

## U. Share link tests (V2, ADR-011) — not yet runnable

| Case | Expected |
|---|---|
| Create share | returns share URL + one-time delete token; stored payload round-trips byte-identical, unicode preserved |
| Token properties | tokens unique and unpredictable across many generations; database stores SHA-256 hashes only, never raw tokens |
| Fetch valid share | normalized `Transcript` shape, same contract as extraction |
| Unknown vs expired token | identical safe 404 for both — no enumeration oracle |
| Delete wrong token | rejected safely; correct token removes the row immediately |
| Oversized payload | 413, safe error, nothing stored |
| Creation flood | 429 with `Retry-After` once the share-specific bucket is exhausted |
| Logging | no transcript content and no full share/delete token in any log record (`caplog` assertion) |
| Expiry purge | rows past `expires_at` removed; reads after expiry fail safely |
| Consent UI | sharing impossible without the explicit disclosure action (frontend test) |

## V. Batch and playlist tests (V2, ADR-012) — not yet runnable

| Case | Expected |
|---|---|
| Batch of valid URLs | per-item results in order; extraction calls sequential with delay (mock provider, assert call sequence) |
| Partial failure | one caption-less video → that item errors while others succeed; no mixed or silent transcript |
| Batch over cap | more than 20 items rejected before any extraction |
| Rate budget | batch counts against the same per-IP limit; mid-batch 429 surfaces as a per-item error |
| Playlist spike fixtures | chosen method's responses mocked per §H; every enumerated ID re-validated against `^[A-Za-z0-9_-]{11}$` |
| Playlist unsupported | clear structured error; the rest of the app remains usable |
