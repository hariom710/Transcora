# TESTING.md — Testing and Verification

How correctness is proven. Progress: [TASKS.md](TASKS.md). Rules: [AGENTS.md](../AGENTS.md) §F.

> **Status (2026-11-06):** Suites are green — 48 backend tests (Pytest), 127 frontend tests (Vitest) and 6 Playwright E2E tests, plus clean `eslint`, `tsc --noEmit`, `next build` and `npm audit` (0 vulnerabilities) (recorded in [TASKS.md](TASKS.md)). E2E ran against the dev servers with live YouTube access; production-build E2E awaits deployment (§S). Sections §U–§V cover Version 2 features; their status columns record what was actually run. **Never record a result here that was not actually observed.**

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

Status: green for pure logic — 127 Vitest tests over URL parsing, timestamps, search, export builders (incl. plain-text clipboard variant, CSV, DOCX, export options, scope filtering, Unicode round-trip across all string formats, DOCX ZIP/`word/document.xml` parsing via `node:zlib`, PDF embedded-font `FontFile2`/ToUnicode assertions + base-14 fallback + pagination, empty-transcript matrix over all 7 formats, 5000-segment large-transcript checks, Unicode filenames and MIME types), playback sync (`findActiveSegment`), productivity tools (fillers, cleanup, replace, bulk transform, undo/redo reducer), the Gemini client (feature prompts, context truncation, error mapping, response extraction, speaker-label parse/apply) and the T5 logic (TXT/SRT/VTT/MD importers, line diff, batch runner, share API client + consent gate) (`frontend/tests/`). Editing, counts and loading/empty/error rendering have no automated component tests; they were verified manually in the browser up to T2 — from T3 on the agent's browser tooling was removed (2026-11-05), so T3 was verified via lint/tsc/Pytest/`next build`/HTTP smoke only. Browser tooling was restored before T4, which was verified interactively (see §R); T5 was likewise verified interactively (share lifecycle, library save/reload/open/remove, import, compare, batch — see §U/§V). The IndexedDB library (`lib/library.ts`) has no unit tests — node has no IndexedDB and adding `fake-indexeddb` was rejected as a dependency; its flows were verified live in the browser instead. Playwright E2E covers the main flows from T6 on (§G).

## F. TypeScript validation

```
npx tsc --noEmit
npm run lint
```

Strict mode must produce zero errors. Status: green — `eslint` clean and zero `tsc` errors on every run.

## G. End-to-end testing (Playwright)

Happy path: paste URL → transcript rendered → search finds a match → export SRT downloads.
Error paths: invalid URL, caption-less video, backend unavailable.

Status: Playwright **installed in T6** (`@playwright/test` + Chromium, dev dependency). Suite in `frontend/e2e/` ran green 2026-11-06 — 6 tests: homepage validation (invalid URL alert), Library/Batch nav, library and batch empty states, full extraction flow (real backend + live captions, 10+ segments, all tranche controls present), save → library → reopen (`?saved=`, language picker hidden), and T2 export downloads (menu → options dialog → real SRT + PDF files with content assertions — see §N). Config (`playwright.config.ts`) reuses the running dev servers or starts them itself (backend with `DATABASE_URL`). Live-caption tests can transiently hit YouTube HTTP 429 under repeated runs (observed 2026-11-06; passed on retry — the error UI + "Try again" rendered correctly). Not yet covered: caption-less video and backend-down error paths (planned with the production-build run in §S).

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
| CSV | RFC 4180 (CRLF, quoting/doubling), timestamp column toggle, metadata rows |
| DOCX | ZIP magic `PK`, valid OOXML parsed from `word/document.xml` with `node:zlib.inflateRawSync` (no unzip dependency), metadata + formatting honoured, Unicode text |
| PDF | `%PDF-` + `%%EOF`, embedded Noto Sans (`FontFile2`), `beginbfchar` ToUnicode mappings for Cyrillic/Greek/Latin-Extended (`<041f>`, `<039a>`, `<0142>`), base-14 Helvetica fallback when no font bytes, 4000-segment pagination (>10 pages, no clipping) |
| Unicode | Cyrillic/Greek/Latin-Extended round-trip through TXT/SRT/VTT/MD/CSV + DOCX `document.xml` + PDF; Unicode-safe filenames (path chars stripped, letters kept) |
| Empty | `toSrt`→`""`, `toVtt`→`"WEBVTT\n"`, empty-safe output from all 7 formats via `buildExport` (name + MIME) |
| Large | 5000 segments: sequential SRT cue numbering to the last cue, one TXT line per segment, no truncation in string formats; §O covers 10k+ perf |
| Options | timestamps off, paragraph grouping at caption gaps, filename override, scope filter (`filterSegments`), MIME types per format |
| All | user edits reflected; original timestamps preserved |
| E2E | `e2e/export.spec.ts` — real downloads: SRT (cue/timestamp regex, sequential blocks) and PDF (`%PDF-`, `FontFile2`, `%%EOF`), suggested filename without path characters, `role=status` "Downloaded" |

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

| Case | Expected | Status |
|---|---|---|
| Missing API key | AI controls disabled, app fully usable | `[x]` live browser check + `generateContent` missing-key unit test (no network call) |
| Invalid API key | clear message, no crash | `[x]` live browser check (400 → "Google rejected that API key.") + `mapHttpError` unit tests |
| Quota exceeded | clear message, retry guidance | `[x]` unit test (429 → quota message) |
| Request failure / timeout | safe error, transcript untouched | `[x]` unit tests (network/timeout mapping; response bodies never leak into messages) |
| Very long transcript | graceful handling, no silent truncation without notice | `[x]` unit test (loud truncation notice past 400k chars) + truncation chip in the panel |
| Model response malformed | validated before display | `[x]` unit tests (`extractText`, `parseLabels` reject malformed/empty payloads) |
| Valid key end-to-end | summaries generate in the browser | `[x]` live check — real Gemini 200 responses observed, plain-text output rendered |
| Key never leaves the browser | no request to our backend | `[x]` network inspection — only `generativelanguage.googleapis.com` calls; memory-only default, opt-in persistence, Forget key verified live |

Key never appears in logs or in any request to our backend.

## S. Production release checklist

- [ ] All suites green in CI
- [x] Full Playwright E2E green against a production build — 5/5 passed against `next start` (2026-11-05); deployment-environment run still pending
- [ ] Real transcript extracted **from the deployed environment**
- [ ] Rate limiting, CORS and timeouts active in production
- [ ] No secrets in the bundle or repository
- [ ] Light and dark themes verified
- [ ] Mobile viewport verified
- [ ] Error states verified with backend stopped
- [x] Dependency audit clean of high-severity issues — `npm audit` reports **0 vulnerabilities** (2026-11-05; `minimatch` override in `frontend/package.json`); `pip-audit -r requirements.txt` reports **no known vulnerabilities**
- [ ] Share lifecycle (create → read → expire → delete) verified in production (ADR-011)
- [ ] [SECURITY.md](SECURITY.md) §L checklist signed off

## T. Windows development commands

Aligned with this environment: **Windows 10/11, Node 22, Python 3.13, Git**. No Docker.

| Purpose | Command | Status |
|---|---|---|
| Frontend dev | `npm run dev` | runnable |
| Type check | `npx tsc --noEmit` | green |
| Lint | `npm run lint` | green |
| Frontend tests | `npm test` | green (127) |
| Frontend build | `npm run build` | green |
| Backend dev | `uvicorn app.main:app --reload` | runnable |
| Backend tests | `pytest -q` | green (48) |
| Targeted test | `pytest tests/test_url_parser.py -q` | runnable |
| E2E | `npx playwright test` | green (6) — dev servers + live captions |

These match the project's actual configuration. Update this table if the configuration differs — document only commands the real configuration supports.

## U. Share link tests (V2, ADR-011) — runnable; executed 2026-11-05

| Case | Expected | Status |
|---|---|---|
| Create share | returns share URL + one-time delete token; stored payload round-trips byte-identical, unicode preserved | `[x]` `test_create_and_fetch_roundtrip` (11 tests in `test_shares_api.py`) + live browser create |
| Token properties | tokens unique and unpredictable across many generations; database stores SHA-256 hashes only, never raw tokens | `[x]` `test_tokens_unique_and_only_hashes_stored` |
| Fetch valid share | normalized `Transcript` shape, same contract as extraction | `[x]` roundtrip test + `/s/[token]` rendered all 61 segments in the browser |
| Unknown vs expired token | identical safe 404 for both — no enumeration oracle | `[x]` `test_unknown_and_expired_token_identical_404` + live check (deleted and unknown 404 bodies byte-identical) |
| Delete wrong token | rejected safely; correct token removes the row immediately | `[x]` `test_delete_requires_correct_token_and_removes_row` + live delete → 200 then 404 |
| Oversized payload | 413, safe error, nothing stored | `[x]` `test_oversized_body_rejected_and_nothing_stored` (1 MiB path-aware cap) |
| Field caps | segment-count / text-length caps rejected | `[x]` `test_field_caps_rejected` |
| Creation flood | 429 with `Retry-After` once the share-specific bucket is exhausted | `[x]` `test_creation_flood_429_with_retry_after` |
| Logging | no transcript content and no full share/delete token in any log record (`caplog` assertion) | `[x]` `test_logging_carries_metadata_only` |
| Expiry purge | rows past `expires_at` removed; reads after expiry fail safely | `[x]` `test_expired_rows_purged_by_lazy_sweep` |
| Sharing disabled without `DATABASE_URL` | 503 `SHARES_UNAVAILABLE`, feature off | `[x]` `test_shares_disabled_without_database_url` |
| Consent UI | sharing impossible without the explicit disclosure action (frontend test) | `[x]` `createShare` consent-gate Vitest test; live: Create stayed disabled until the checkbox was checked |
| Share page indexing | `noindex` meta + robots exclusion | `[x]` live: `meta robots=noindex,nofollow`; `robots.txt` = `Disallow: /s/` |
| JSON content type | application/json contract on create | `[x]` `test_json_content_type_shape` |

## V. Batch and playlist tests (V2, ADR-012) — executed 2026-11-05

| Case | Expected | Status |
|---|---|---|
| Batch of valid URLs | per-item results in order; extraction calls sequential with delay | `[x]` `lib/batch.ts` Vitest (mock fetch, call order/delay); live browser run: 2 URLs → "2 ok · 0 failed", both Open links worked |
| Partial failure | one failing item errors while others succeed; no mixed or silent transcript | `[x]` `lib/batch.ts` unit test |
| Batch over cap | more than 20 items rejected before any extraction | `[x]` `lib/batch.ts` unit test (`BATCH_MAX`) + cap warning in the UI |
| Cancel | running batch stops before the next item | `[x]` `lib/batch.ts` unit test ("stops cleanly when cancelled"); Cancel button present in UI |
| Rate budget | mid-batch 429 surfaces as that item's error | `[x]` `lib/batch.ts` unit test ("surfaces a mid-batch rate limit as that item's error") |
| Playlist spike fixtures | chosen method's responses mocked per §H; every enumerated ID re-validated against `^[A-Za-z0-9_-]{11}$` | `[x]` spike run 2026-11-05 (`backend/scripts/playlist_spike.py`): 54 unique valid ids, 0 invalid — Innertube viable, ToS-sensitive, owner review pending |
| Playlist unsupported (UI) | clear structured error; the rest of the app remains usable | `[x]` no playlist UI ships in T5 (spike only) — nothing to break; batch works independently |
