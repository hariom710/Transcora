# TESTING.md — Testing and Verification

How correctness is proven. Progress: [TASKS.md](TASKS.md). Rules: [AGENTS.md](../AGENTS.md) §F.

> **Status (2026-11-07):** Suites are green — 48 backend tests (Pytest), 137 frontend tests (Vitest) — plus clean `eslint`, `tsc --noEmit`, `next build` and `npm audit` (0 vulnerabilities) (recorded in [TASKS.md](TASKS.md); T3 execution evidence in §W). Playwright E2E: **12/14 passed, 2 blocked by the upstream YouTube IP rate limit** (`transcript.spec.ts:5` and `:28` → `UPSTREAM_BLOCKED` 503, confirmed by direct backend probe; both passed in the 2026-11-06 green run — see §W). E2E ran against the dev servers with live YouTube access, paced for caption quota (§G); production-build E2E awaits deployment (§S). Sections §U–§W cover Version 2 features and T3; their status columns record what was actually run. **Never record a result here that was not actually observed.**

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

Status: green — **137 Vitest tests** over URL parsing, timestamps, search (incl. `wrapIndex` prev/next wrapping), export builders (incl. plain-text clipboard variant, CSV, DOCX, export options, scope filtering, Unicode round-trip across all string formats, DOCX ZIP/`word/document.xml` parsing via `node:zlib`, PDF embedded-font `FontFile2`/ToUnicode assertions + base-14 fallback + pagination, empty-transcript matrix over all 7 formats, 5000-segment large-transcript checks, Unicode filenames and MIME types), playback sync (`findActiveSegment`), productivity tools (fillers, cleanup, replace incl. adjacent/Unicode/replacement-contains-query/never-blank edges, bulk transform, `transcriptStats`, undo/redo reducer incl. the `reset` action added by the T3 audit), the Gemini client (feature prompts, context truncation, error mapping, response extraction, speaker-label parse/apply) and the T5 logic (TXT/SRT/VTT/MD importers, line diff, batch runner, share API client + consent gate) (`frontend/tests/`). Editing, counts and loading/empty/error rendering were verified manually in the browser up to T2 and had no automated coverage — from T3 they are covered by `e2e/productivity.spec.ts` (§G) plus an interactive browser pass (§W). The IndexedDB library (`lib/library.ts`) has no unit tests — node has no IndexedDB and adding `fake-indexeddb` was rejected as a dependency; its flows were verified live in the browser instead (fixture seeding exercised the read path in §W, write path via save/reopen in §U).

## F. TypeScript validation

```
npx tsc --noEmit
npm run lint
```

Strict mode must produce zero errors. Status: green — `eslint` clean and zero `tsc` errors on every run.

## G. End-to-end testing (Playwright)

Happy path: paste URL → transcript rendered → search finds a match → export SRT downloads.
Error paths: invalid URL, caption-less video, backend unavailable.

Status: Playwright **installed in T6** (`@playwright/test` + Chromium, dev dependency). Suite in `frontend/e2e/` — **14 tests** since T3 (2026-11-07): homepage validation (invalid URL alert), Library/Batch nav, library and batch empty states, full extraction flow (real backend + live captions, 10+ segments, all tranche controls present), save → library → reopen (`?saved=`, language picker hidden), T2 export downloads (menu → options dialog → real SRT + PDF files with content assertions — see §N), and T3 `productivity.spec.ts` (8 tests: full workflow edit → stats → undo/redo → search prev-wrap → replace → fillers/cleanup → highlight/note/bookmark → bookmark nav → reading mode → TXT export of edited content; loading skeleton via delayed+aborted route; malformed-URL alert; empty `?saved=` fixture; D1 language-switch reset; responsive 375/768/1280 overflow + touch targets; light/dark themes + `/` shortcut + zero console errors). Config (`playwright.config.ts`) reuses the running dev servers or starts them itself (backend with `DATABASE_URL`). Live-caption tests are quota-sensitive: bursts of rapid extracts trigger YouTube rate-limiting (`UPSTREAM_BLOCKED` 503 → "YouTube is temporarily refusing requests" card) and on 2026-11-06/07 an IP-level block that cleared overnight — live tests must be paced (≥75 s between single runs; observed quota ≈ 2 successful extracts per short window). Fixture-only tests (empty `?saved=`, responsive, themes, malformed URL, export) are unaffected. Not yet covered: caption-less video and backend-down error paths (planned with the production-build run in §S). T3 execution evidence: §W.

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
| Frontend tests | `npm test` | green (137) |
| Frontend build | `npm run build` | green |
| Backend dev | `uvicorn app.main:app --reload` | runnable |
| Backend tests | `pytest -q` | green (48) |
| Targeted test | `pytest tests/test_url_parser.py -q` | runnable |
| E2E | `npx playwright test` | 14 tests — dev servers + live captions; pace live tests (§G) |

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

## W. T3 verification evidence (executed 2026-11-06/07)

Everything below was actually executed in this environment; nothing is inferred.

| Check | Result |
|---|---|
| `npm run lint` (eslint) | green — clean after all T3 edits |
| `npx tsc --noEmit` (src + tests + e2e) | green — zero errors |
| `npm test` (Vitest) | green — **137/137** (incl. +10 T3 tests) |
| `pytest -q` | green — **48/48** (exit 0) |
| `npm audit` | 0 vulnerabilities |
| `npm run build` (next build) | green — 11 routes, TS clean during build |
| `npx playwright test` | 12/14 passed (full suite 2026-11-07: 11 passed/3 failed -> D1 passed on paced retry 12.5 s); transcript.spec.ts:5 and :28 BLOCKED by YouTube IP quota - UPSTREAM_BLOCKED 503 confirmed by direct backend probe; both passed in 2026-11-06 green run |
| Secret scan over the final diff | clean (no keys/tokens/passwords) |

**Interactive browser pass** (fixture `T3VERIFY01` seeded in IndexedDB + live captions, dev build):

- Edit → stats live-update (115→113 words, 651→626 chars); undo/redo restored content exactly.
- Search `never` → `1/3`; prev at first match wrapped to `3/3` (D2); next wrapped `1/3`.
- Replace all (3) → toast "Replace: 3 segments updated", counter `0/0`, marks cleared, chars 626→629; undo restored fully.
- Remove fillers (8 segments) and Clean up text (2 segments) — each one undo step.
- Highlight `aria-pressed` + "1 highlighted"; multiline note rendered on two lines (`whitespace-pre-wrap`, D6); ★ bookmarks → toolbar `★ 2` → bookmark nav landed on the bookmarked segment (search match correctly wins while a query is active).
- Reading mode via `r` (separator hidden); typing `r` in the search field does **not** toggle it; undo after reading mode works.
- Dark and light themes; **zero console errors** across the pass.
- Loading skeleton observed live (delayed route); error card observed live during the IP-block episode ("YouTube is temporarily refusing requests").
- D1 language-switch reset covered by `productivity.spec.ts:260` (passed on paced retry, 12.5 s).

**Performance** (10,000-segment fixture `PERF10K0001`, in-app browser, dev build):

- 10000 articles rendered; navigation `domInteractive` 209 ms, `load` event 544 ms; JS heap ≈ 130 MB; stats correct (`10000 segments · 250000 words · 1268894 characters · 1250 min read`).
- Search keystroke → committed paint (double-rAF): worst case query matching all 10 000 segments **2708 ms**, rare query **2763 ms**, clear **1801 ms**. Dev-build numbers (no production minification/hydration tuning); noted as an observation, not a regression gate — no T3 perf budget was defined.

**Blocked / external:** live YouTube caption access is quota-limited from this machine (≈2 extracts per short window; an IP-level block on 2026-11-06 cleared overnight). Fixture-only E2E tests are unaffected; live tests must be paced ≥75 s apart (§G).
