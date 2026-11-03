# TASKS.md — Development Checklist

Master progress tracker. Requirements: [PROJECT.md](PROJECT.md) · Testing: [TESTING.md](TESTING.md) · Decisions: [DECISIONS.md](DECISIONS.md).

**Status:** `[ ]` not started · `[~]` in progress · `[x]` completed · `[!]` blocked.

> **Repository state at creation: empty directory, no application source code, no tests.** Every task below is `[ ]`. Nothing is marked complete because it is planned. Update a task's status only after the work is actually done and verified.

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
- `[~]` Test harness: Pytest configured and green (37 tests); Playwright not installed — E2E so far done manually in a browser
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
- `[ ]` Optional local recent-history — deferred: optional, privacy-first; not implemented until requested

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

- `[ ]` Verify current Gemini free-tier models, limits, pricing
- `[ ]` Optional AI settings section (key entry, explicit opt-in persistence)
- `[ ]` AI Summary, Smart Notes, Key Points, Chapter Generator
- `[ ]` Ask This Video, Topic Extraction, Learning Notes
- `[ ]` Client-side Gemini client — key never reaches our backend
- `[ ]` Graceful handling of missing/invalid key, quota exhaustion, request failure

**Deliverables:** AI module behind an explicit user action.
**Acceptance criteria:** with a valid key, summaries generate; with no key, the app behaves exactly as before.
**Testing requirements:** [TESTING.md](TESTING.md) §R.
**Security:** [SECURITY.md](SECURITY.md) §H.

---

## Phase 11 — Deployment and final release

**Objective:** Public, verified, production-ready site.
**Depends on:** Phases 9–10.

- `[ ]` Frontend deployed to Vercel
- `[ ]` Backend deployed to a Python-compatible host
- `[ ]` Production CORS and environment configuration
- `[ ]` Extract real transcripts **from the deployed environment**
- `[ ]` Free-tier sleep/limit behavior understood and documented
- `[ ]` Production release checklist complete ([TESTING.md](TESTING.md) §S)
- `[ ]` README and public launch

**Deliverables:** live site passing the release checklist.
**Acceptance criteria:** a real user can paste a URL and export a transcript from production.

---

## Phase-level completion criteria

A phase is complete only when **all** its tasks are `[x]` **and** its testing requirements have actually been executed and recorded.

## Update rule

Whenever a task is completed, update this file with its real status in the same change. Never mark `[x]` from a plan alone.
