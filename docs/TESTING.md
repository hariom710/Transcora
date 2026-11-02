# TESTING.md — Testing and Verification

How correctness is proven. Progress: [TASKS.md](TASKS.md). Rules: [AGENTS.md](../AGENTS.md) §F.

> **No test has been executed in this repository yet.** There is no application source code, no test configuration and no CI. Commands below are the target setup and are marked accordingly — they will only work once Phase 1 scaffolding exists. **Never record a result here that was not actually observed.**

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

Status: **not yet runnable** (no backend scaffold).

## C. Backend integration testing

Service + mocked provider, verifying orchestration, timeout handling and error taxonomy.

Status: **not yet runnable**.

## D. API testing

FastAPI `TestClient` (or httpx ASGI transport) against `/health`, `/api/v1/videos/inspect`, `/api/v1/videos/{id}/languages`, `/api/v1/transcripts`.

Assert status codes, response shape, and the unified error contract.

Status: **not yet runnable**.

## E. Frontend testing

Component behaviour: search matching, editing, counts, export button states, loading/empty/error rendering.

Status: **not yet runnable** (no frontend scaffold).

## F. TypeScript validation

```
npx tsc --noEmit
npm run lint
```

Strict mode must produce zero errors. Status: **not yet runnable**.

## G. End-to-end testing (Playwright)

Happy path: paste URL → transcript rendered → search finds a match → export SRT downloads.
Error paths: invalid URL, caption-less video, backend unavailable.

Status: **not yet runnable**.

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

See [SECURITY.md](SECURITY.md) §B–§E, §L.

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
- [ ] [SECURITY.md](SECURITY.md) §L checklist signed off

## T. Windows development commands

Aligned with this environment: **Windows 10/11, Node 22, Python 3.13, Git**. No Docker.

| Purpose | Command | Status |
|---|---|---|
| Frontend dev | `npm run dev` | not yet runnable |
| Type check | `npx tsc --noEmit` | not yet runnable |
| Lint | `npm run lint` | not yet runnable |
| Frontend tests | `npm test` | not yet runnable |
| Backend dev | `uvicorn app.main:app --reload` | not yet runnable |
| Backend tests | `pytest -q` | not yet runnable |
| Targeted test | `pytest tests/test_url_parser.py -q` | not yet runnable |
| E2E | `npx playwright test` | not yet runnable |

These become runnable when Phase 1 scaffolding lands. Update this table if the project's actual configuration differs — document only commands the real configuration supports.
