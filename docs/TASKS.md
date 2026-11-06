# TASKS.md — Development Checklist

Master progress tracker. Requirements: [PROJECT.md](PROJECT.md) · Testing: [TESTING.md](TESTING.md) · Decisions: [DECISIONS.md](DECISIONS.md).

**Status:** `[ ]` not started · `[~]` in progress · `[x]` completed · `[!]` blocked.

> Every task began as `[ ]` and is marked `[x]` only after the work was actually done and verified. Repository state at creation: empty directory, no application source code, no tests.

---

## Phase 1 — Project initialization

**Objective:** Working scaffold for both services with tooling in place.
**Depends on:** nothing.

- `[x]` Initialize Git repository and remote
- `[x]` Scaffold Next.js + TypeScript + Tailwind frontend
  - `[x]` App Router, strict TS, lint
  - `[ ]` format — no formatter configured yet
  - `[~]` shadcn/ui — not installed; local `cva` components (`ui/button`, `ui/input`, `ui/badge`) plus native controls per [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) §G cover the primitives used
- `[x]` Scaffold FastAPI backend
  - `[x]` `app/` structure per [ARCHITECTURE.md](ARCHITECTURE.md) §C
  - `[x]` Pydantic Settings, `.env.example`
- `[~]` Test harness: Pytest configured and green (48 tests as of T5); Playwright not installed — E2E so far done manually in a browser
- `[x]` `GET /health` returns 200 (verified live and covered by a test)

**Deliverables:** two runnable services, `npm run dev` and `uvicorn app.main:app`.
**Acceptance criteria:** both services start locally; health check passes.
**Testing requirements:** smoke test for `/health`.

---

## Phase 2 — YouTube URL processing

**Objective:** Reliable, safe URL → video ID conversion.
**Depends on:** Phase 1.

- `[x]` `utils/url_parser.py` with domain allowlist
- `[x]` Support `watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`
- `[x]` Strict video ID format validation
- `[x]` Reject non-YouTube and malformed URLs
- `[x]` Frontend client-side validation mirroring backend rules (`src/lib/url.ts`)

**Deliverables:** `parse_video_id()`, client-side twin, error messages.
**Acceptance criteria:** all four URL forms extract the correct ID; everything else rejected.
**Testing requirements:** [TESTING.md](TESTING.md) §I.
**Depends on:** security review — [SECURITY.md](SECURITY.md) §B.

---

## Phase 3 — Transcript extraction engine

**Objective:** Fetch and normalize captions reliably.
**Depends on:** Phase 2.

- `[x]` `providers/base.py` interface
- `[x]` `youtube_provider.py` using youtube-transcript-api
  - `[x]` manual and automatic caption tracks
  - `[x]` translate-track support when offered
- `[x]` Normalizer → common `Transcript` shape
- `[x]` Timestamp conversion — provider already returns seconds; no conversion module needed (no caller)
- `[x]` Error taxonomy: no captions, private, restricted, blocked, timeout
- `[x]` Timeouts and concurrency limits (`services/runner.py`, threadpool + `asyncio.wait_for`)

**Deliverables:** extraction service returning normalized segments.
**Acceptance criteria:** a caption-bearing video yields timestamped segments; caption-less video returns a clear error.
**Testing requirements:** [TESTING.md](TESTING.md) §J, §L, §M — against mocked responses.
**Verified live:** 61 segments from a real video, 5 languages listed, `CAPTIONS_UNAVAILABLE` for an unsupported language.

---

## Phase 4 — Video metadata and language management

**Objective:** Preview data and language choice.
**Depends on:** Phase 3.

- `[x]` Metadata retrieval (title, channel, thumbnail) with graceful failure — duration stays unset: oEmbed does not expose it and the YouTube Data API would need a key (out of Version 1 scope)
- `[x]` `GET /api/v1/videos/{id}/languages`
- `[x]` Language detection and default selection
- `[x]` Video preview component
- `[x]` Language selector bound to workspace (verified live: switching to German refetched 60 segments)

**Deliverables:** inspect + languages endpoints, preview UI.
**Acceptance criteria:** metadata renders when available; unavailable metadata never blocks transcript extraction.
**Testing requirements:** [TESTING.md](TESTING.md) §K.

---

## Phase 5 — Transcript API and data management

**Objective:** Stable versioned API contract.
**Depends on:** Phases 2–4.

- `[x]` `POST /api/v1/videos/inspect`
- `[x]` `POST /api/v1/transcripts`
- `[x]` Pydantic request/response schemas
- `[x]` Unified error response shape (`{"error": {"code", "message"}}`)
- `[x]` CORS restricted to explicit frontend origin
- `[x]` Rate limiting, request size limits
- `[x]` Frontend API client + shared types (`src/services/api.ts`, `src/types/`)

**Deliverables:** versioned endpoints, typed client.
**Acceptance criteria:** valid request returns normalized transcript; invalid input returns structured 4xx.
**Testing requirements:** [TESTING.md](TESTING.md) §D, §P, §Q.

---

## Phase 6 — Frontend and transcript workspace

**Objective:** Usable, responsive transcript viewer.
**Depends on:** Phase 5.

- `[x]` Homepage: 10 sections per [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) §H — sticky nav, hero, URL form, product preview, features, how-it-works, exports, FAQ, closing CTA, footer
- `[x]` Apple-inspired UI redesign — CSS-only interactions (150–200ms), no animation dependencies, pill buttons, `.card` surfaces, export dropdown, toast feedback
- `[x]` Loading, empty and error states (verified live for invalid URL and upstream `VIDEO_NOT_FOUND`)
- `[x]` Transcript workspace: timestamped segment list
- `[x]` Clickable timestamps → video position
- `[x]` Light and dark themes (verified live: class toggle + `localStorage` persistence)
- `[x]` Responsive layout — verified live at 375px (no horizontal overflow, 44px touch targets, single column), 786px (stacked toolbar, full-width search) and desktop (side-by-side toolbar)
- `[x]` Accessibility pass — Lighthouse a11y/best-practices/SEO 100 in both themes after fixing two contrast defects (white-on-`#0a84ff` buttons → `#0071e3`; secondary text `#86868b` → `#6e6e73`); labels, focus-visible, ARIA live regions and reduced-motion in place. Screen-reader pass not run.

**Deliverables:** complete viewer per [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) §H–§J.
**Acceptance criteria:** paste URL → readable timestamped transcript on mobile and desktop.
**Testing requirements:** [TESTING.md](TESTING.md) §E, §F, §G.

---

## Phase 7 — Transcript productivity tools

**Objective:** Search, edit and manipulate transcript in-browser.
**Depends on:** Phase 6.

- `[x]` Client-side search with highlighted matches (verified live: 38 matching segments, 40 highlights)
- `[x]` Prev/next match navigation
- `[x]` Text editing of segments
- `[x]` Whitespace/format normalization (backend side, `transcript_service._clean`)
- `[x]` Copy all / copy segment / select all
- `[x]` Character, word and segment counts
- `[x]` Auto-scroll to active segment
- `[x]` Local recent-history — built in T5 (`recordRecent` in `lib/library.ts`, browser-local Recent list on `/library`, privacy-first per ADR-004)

**Deliverables:** search and editing controls in the workspace.
**Acceptance criteria:** searching finds and highlights matches; edits persist in session state.
**Testing requirements:** [TESTING.md](TESTING.md) §E, §O.

---

## Phase 8 — Export and download system

**Objective:** Export without an account.
**Depends on:** Phase 7.

- `[x]` `toTxt`, `toSrt`, `toVtt`, `toMarkdown`, `toPdf`
- `[x]` Preserve original timestamps
- `[x]` Reflect user edits in output files
- `[x]` Copy-to-clipboard
- `[x]` Export dropdown menu (TXT · SRT · VTT · MD · PDF · Copy · Select all), keyboard accessible (Escape/outside click), with toast confirmation

**Deliverables:** five exporters + clipboard.
**Acceptance criteria:** SRT/VTT output validates against their formats; TXT/MD are clean; PDF is readable.
**Testing requirements:** [TESTING.md](TESTING.md) §N.
**Verified live:** SRT download — 61 cues ↔ 61 arrows, UTF-8 intact, comma decimals only; PDF download — `%PDF-1.3`, 2 pages, `%%EOF` present.

---

## Phase 9 — Testing, security and performance

**Objective:** Verified, hardened, fast.
**Depends on:** Phases 1–8.

- `[x]` Backend unit + integration suites green (37 pytest tests)
- `[x]` Frontend unit suites green (48 vitest tests); `eslint` and `tsc --noEmit` clean; `next build` succeeds
- `[ ]` Playwright E2E happy path and error paths — not installed; equivalent flows verified manually in a browser (submit → transcript → search → SRT/PDF download → theme toggle → error paths → language switch)
- `[~]` Security checklist signed off ([SECURITY.md](SECURITY.md) §L) — SSRF, CORS, rate limit and body-size limits covered by tests; full §L review not run
- `[x]` SSRF and URL-allowlist tests
- `[~]` Rate-limit verified by test; upstream timeout path not yet exercised
- `[ ]` Large-transcript profiling; virtualize if needed
- `[ ]` Dependency audit

**Deliverables:** CI-green suites, performance notes.
**Acceptance criteria:** all suites pass; no high-severity dependency findings; large transcript renders without UI freeze.
**Testing requirements:** [TESTING.md](TESTING.md) §O, §P, §Q, §S.

---

## Phase 10 — Gemini AI integration

**Objective:** Optional AI features on a user-supplied key.
**Depends on:** Phase 9. Version 2 — see [PROJECT.md](PROJECT.md) §F.

- `[x]` Verify current Gemini free-tier models, limits, pricing (2026-11-05: `gemini-3.6-flash` free without billing; 3.8/3.6 Flash and Flash-Lite free, Gemini 4 Argon paid-only → `GEMINI_MODEL = "gemini-3.6-flash"`)
- `[x]` Optional AI settings section (key entry, explicit opt-in persistence, visible "Forget key", browser-exposure disclosure)
- `[x]` AI Summary, Smart Notes, Key Points, Chapter Generator
- `[x]` Ask This Video, Topic Extraction, Learning Notes
- `[x]` Client-side Gemini client — key never reaches our backend (`x-goog-api-key` header straight to Google)
- `[x]` Graceful handling of missing/invalid key, quota exhaustion, request failure (distinct `AiFailure` kinds, unit-tested; invalid-key verified live)

**Deliverables:** AI module behind an explicit user action.
**Acceptance criteria:** with a valid key, summaries generate; with no key, the app behaves exactly as before.
**Testing requirements:** [TESTING.md](TESTING.md) §R.
**Security:** [SECURITY.md](SECURITY.md) §H.

---

## Phase 11 — Deployment and final release

**Objective:** Public, verified, production-ready site.
**Depends on:** Phases 9–10.

- `[~]` Frontend deployed to Vercel — **owner action pending** (no deploy credentials in this environment; build is green and deploy-ready)
- `[~]` Backend deployed to a Python-compatible host — **owner action pending** (same; requires a host with `DATABASE_URL` + `CORS_ORIGINS`)
- `[~]` Production CORS and environment configuration — configured and documented (`CORS_ORIGINS`, `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL` in `.env.example` files); values to set at deploy time
- `[ ]` Extract real transcripts **from the deployed environment**
- `[ ]` Free-tier sleep/limit behavior understood and documented
- `[ ]` Production release checklist complete ([TESTING.md](TESTING.md) §S)
- `[~]` README and public launch — README rewritten for release (2026-11-05); public launch owner action

**Deliverables:** live site passing the release checklist.
**Acceptance criteria:** a real user can paste a URL and export a transcript from production.

---

## Version 2 tranches — approved 2026-11-03

Owner-approved delivery plan: six tranches, T1 → T6. Protocol revised by owner 2026-11-03: commit + push after each tranche, no review pause between tranches. T4 reuses **Phase 10** and T6 reuses **Phase 11** above — those sections stay authoritative for AI and deployment. Governance: [ADR-011](DECISIONS.md), [ADR-012](DECISIONS.md).

- `[x]` **T0 — Governance (2026-11-03)**
  - `[x]` ADR-011 — database scoped exclusively to shareable transcripts and their lifecycle; ADR-004 marked Superseded; ADR-005 (no accounts) and ADR-009 (browser-side Gemini keys) explicitly preserved
  - `[x]` ADR-012 — playlist/batch accepted with recorded feasibility research (spike required before playlist ships) and binding security constraints
  - `[x]` PROJECT.md §F/§J/§K, ARCHITECTURE.md (§A/§C/§E/§J/§N, statuses), SECURITY.md (§A/§G/§L/§M + new §N–§O), TESTING.md (statuses + new §U–§V), TASKS.md and AGENTS.md updated consistently; DESIGN_SYSTEM.md reviewed — no change needed
- `[x]` **T1 — Workspace v2 (2026-11-03)**
  - `[x]` Embedded YouTube IFrame player (script-loaded `iframe_api`, no new dependency): seek from timestamps, duration via `getDuration()`, play/pause and error fallback to the metadata card
  - `[x]` Follow-playback highlight + auto-scroll (`findActiveSegment` binary search in `lib/playback.ts`, reduced-motion aware, scrolls only when off-screen); copy with/without timestamps; A−/A+ font size persisted via localStorage; resizable two-pane (≥1024px, pointer + arrow keys) with sticky video; fullscreen; keyboard shortcuts `/ k j l f`
  - `[x]` Privacy page discloses the embedded player (new third-party contact); 8 new Vitest tests → 56 total; browser-verified (player, seek, highlight, font, copy menu, toast, shortcuts)
- `[x]` **T2 — Export expansion (2026-11-03)**
  - `[x]` Dependency decision: `docx` v9.15.1 (MIT) for real .DOCX — real OOXML cannot be hand-rolled within the minimal-code rule
  - `[x]` CSV (RFC 4180) + DOCX builders; `buildExport` now async; `ExportOptions` (timestamps, metadata header, segment/paragraph formatting, filename) with per-format applicability (SRT/VTT fixed by spec, PDF fixed, MD heading always shown)
  - `[x]` Export options dialog: format pills, filename input, scope (entire vs current search matches via `filterSegments`), Escape/outside-click close with focus return; menu wired through the dialog; homepage/about copy + format chips updated
  - `[x]` 10 new Vitest tests → 66 total; browser-verified (CSV 2.8 KB valid content, DOCX `PK` + metadata + paragraphs, scope export = exactly the 38 matching lines, Escape/focus return)
- `[x]` **T3 — Productivity (2026-11-05)**
  - `[x]` Find-and-replace (case-insensitive literal, "Replace all (n)" in the search card); remove fillers + clean-up-text bulk tools, each one undo step with a toast count
  - `[x]` Per-segment annotations: highlight tint, inline note, bookmark star + prev/next bookmark toolbar navigation; all client-state (no storage, per ADR-004)
  - `[x]` Reading mode (`r` or toolbar toggle: video hidden, single centred column); undo/redo (`use-edit-history` reducer, 50-step stack, Ctrl/Cmd+Z, Shift+Z or Y) with toolbar buttons
  - `[x]` Statistics extended with reading time (200 wpm) + highlight/note/bookmark counts
  - `[x]` 17 new Vitest tests → 83 total; verification via lint/tsc/Pytest/`next build`/HTTP 200 smoke — browser tooling was removed from the agent environment on 2026-11-05, so no interactive browser pass was possible for this tranche
- `[x]` **T4 — AI (2026-11-05)** → Phase 10 above (browser-side key per ADR-009, plus AI speaker labels)
  - `[x]` `lib/gemini.ts`: free-tier model verified (2026-11-05 → `gemini-3.6-flash`), feature prompts, transcript context with loud 400k-char truncation, error mapping, response extraction (thought parts skipped), JSON speaker-label parse/apply
  - `[x]` `transcript-ai.tsx` modal: password key entry, session-only by default, remember opt-in + Forget key, SECURITY §H disclosure, feature pills, plain-text output, Ask-this-video chat, speaker labels applied as one undoable edit step
  - `[x]` Verified in browser: disabled-without-key + disclosure, Escape close, password/autocomplete-off, real 200 generation flow, live invalid-key error, Forget key clearing storage; 9 new Vitest tests → 92 total
- `[x]` **T5 — Advanced (2026-11-05)**
  - `[x]` Library (`/library`): IndexedDB store (`lib/library.ts`) with Saved + Recent lists, Open/Remove, `?saved=<id>` loading in the workspace (no backend calls, language select hidden, entry metadata shown)
  - `[x]` Import TXT/SRT/VTT/MD (`lib/importers.ts`) via the library file picker — imported files get a synthetic 11-char id, `language_code: "und"`, estimated 3s/line timestamps, and an "Imported" badge; auto-opens in the workspace
  - `[x]` Comparison (`lib/compare.ts`): line diff (LCS with prefix/suffix trim, 4M-cell fallback, 1000-row render cap) in a dialog — stats line + red −/green + markers, fed by a file picker accepting `.txt,.srt,.vtt,.md`
  - `[x]` Shareable links (ADR-011): backend `sqlite3` store via `DATABASE_URL` (`sqlite:///` only; absent → sharing disabled, 503 `SHARES_UNAVAILABLE`), sync routes, 1 MiB path-aware cap on `POST /api/v1/shares` only; `ShareDialog` consent gate → one-time delete token; read-only `/s/[token]` page (`noindex`, plain-text render); `robots.txt` disallows `/s/`; privacy page disclosures
  - `[x]` Batch (`/batch`, ADR-012): textarea of ≤ 20 URLs run sequentially through `POST /api/v1/transcripts` with per-item status, Open links, Cancel and partial-failure tolerance
  - `[x]` Playlist spike (ADR-012): **PASS** (2026-11-05) — `backend/scripts/playlist_spike.py` (Innertube) returned 54 unique valid ids, 0 invalid, first page only; method is ToS-sensitive → owner review required before any playlist UI ships (recorded in ADR-012 change log)
  - `[x]` Browser extension (`extension/`, smallest useful MV3): `activeTab`-only popup that opens the current YouTube video in `/transcript?url=…`; `APP_ORIGIN` is localhost with a `shortcut:` comment to switch at T6 deploy
  - `[x]` Verified in browser: consent gate (Create disabled until checked), share create → 30-day expiry → `/s/` renders all segments with `noindex,nofollow`, delete with correct token → 200 then identical 404s (no enumeration oracle), save → library reload → open, SRT import → workspace, compare diff (1 unchanged · 60 removed · 2 added), batch 2 ok/0 failed with working Open links; checkpoint green — lint 0 errors, `tsc` exit 0, Vitest **114**, Pytest **48**, `next build` with all new routes
- `[x]` **T6 — Release (2026-11-05)** → Phase 11 above (deployment items are owner actions — no credentials in this environment)
  - `[x]` Playwright E2E: `@playwright/test` + Chromium installed (documented T6 dev dependency), `playwright.config.ts` reuses/starts both dev servers; 5 tests green — homepage validation, nav, library/batch empty states, full live extraction flow, save → library → reopen
  - `[x]` Large-transcript profiling (10,000-segment synthetic transcript in IndexedDB): production build — load event 333 ms, FCP 176 ms, search keystroke→commit 240–466 ms, heap 249 MB; dev build was ~5× slower (1.8–2.5 s/keystroke). No virtualization needed yet; noted as the lever in ARCHITECTURE §L
  - `[x]` Dependency audit: `npm audit` **0 vulnerabilities** (was 8 moderate — single `minimatch` root cause via `eslint-config-next`, fixed with a scoped `overrides` entry, lint verified green); backend `pip-audit` run against `requirements.txt`
  - `[x]` SEO: enriched `metadata` (metadataBase/OG/Twitter via `NEXT_PUBLIC_SITE_URL`), `sitemap.ts` (5 static indexable pages; `/transcript` query-driven and `/s/` noindex excluded), verified live on the production build
  - `[x]` PWA: `manifest.ts` (name/colors/`standalone`/SVG icon), `public/icon.svg`, `viewport.themeColor`; verified `<link rel="manifest">` + theme-color in prod HTML. No service worker — the app is online-only by nature (fetches captions); caching would be misleading
  - `[x]` README rewritten: status, features, quick start, test commands
  - `[x]` Usage analytics deliberately skipped (privacy-first, owner decision 2026-11-03)

Checkpoint protocol after every tranche: `eslint` + `tsc` + Vitest + Pytest + `next build` green → browser verification → docs updated in the same change → commit + push → next tranche (owner review deferred to the end, per owner decision 2026-11-03).

---

## Phase-level completion criteria

A phase is complete only when **all** its tasks are `[x]` **and** its testing requirements have actually been executed and recorded.

## Update rule

Whenever a task is completed, update this file with its real status in the same change. Never mark `[x]` from a plan alone.
