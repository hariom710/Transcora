# TASKS.md — Development Checklist

Master progress tracker. Requirements: [PROJECT.md](PROJECT.md) · Testing: [TESTING.md](TESTING.md) · Decisions: [DECISIONS.md](DECISIONS.md).

**Status:** `[ ]` not started · `[~]` in progress · `[x]` completed · `[!]` blocked.

> **Repository state at creation: empty directory, no application source code, no tests.** Every task below is `[ ]`. Nothing is marked complete because it is planned. Update a task's status only after the work is actually done and verified.

---

## Phase 1 — Project initialization

**Objective:** Working scaffold for both services with tooling in place.
**Depends on:** nothing.

- `[ ]` Initialize Git repository and remote
- `[ ]` Scaffold Next.js + TypeScript + Tailwind frontend
  - `[ ]` App Router, strict TS, lint, format
  - `[ ]` shadcn/ui installed and configured
- `[ ]` Scaffold FastAPI backend
  - `[ ]` `app/` structure per [ARCHITECTURE.md](ARCHITECTURE.md) §C
  - `[ ]` Pydantic Settings, `.env.example`
- `[ ]` Test harness: Pytest + Playwright configured
- `[ ]` `GET /health` returns 200

**Deliverables:** two runnable services, `npm run dev` and `uvicorn app.main:app`.
**Acceptance criteria:** both services start locally; health check passes.
**Testing requirements:** smoke test for `/health`.

---

## Phase 2 — YouTube URL processing

**Objective:** Reliable, safe URL → video ID conversion.
**Depends on:** Phase 1.

- `[ ]` `utils/url_parser.py` with domain allowlist
- `[ ]` Support `watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`
- `[ ]` Strict video ID format validation
- `[ ]` Reject non-YouTube and malformed URLs
- `[ ]` Frontend client-side validation mirroring backend rules

**Deliverables:** `parse_video_id()`, client-side twin, error messages.
**Acceptance criteria:** all four URL forms extract the correct ID; everything else rejected.
**Testing requirements:** [TESTING.md](TESTING.md) §I.
**Depends on:** security review — [SECURITY.md](SECURITY.md) §B.

---

## Phase 3 — Transcript extraction engine

**Objective:** Fetch and normalize captions reliably.
**Depends on:** Phase 2.

- `[ ]` `providers/base.py` interface
- `[ ]` `youtube_provider.py` using youtube-transcript-api
  - `[ ]` manual and automatic caption tracks
  - `[ ]` translate-track support when offered
- `[ ]` Normalizer → common `Transcript` shape
- `[ ]` Timestamp conversion (provider format → seconds)
- `[ ]` Error taxonomy: no captions, private, restricted, blocked, timeout
- `[ ]` Timeouts and concurrency limits

**Deliverables:** extraction service returning normalized segments.
**Acceptance criteria:** a caption-bearing video yields timestamped segments; caption-less video returns a clear error.
**Testing requirements:** [TESTING.md](TESTING.md) §J, §L, §M — against mocked responses.

---

## Phase 4 — Video metadata and language management

**Objective:** Preview data and language choice.
**Depends on:** Phase 3.

- `[ ]` Metadata retrieval (title, channel, thumbnail, duration) with graceful failure
- `[ ]` `GET /api/v1/videos/{id}/languages`
- `[ ]` Language detection and default selection
- `[ ]` Video preview component
- `[ ]` Language selector bound to workspace

**Deliverables:** inspect + languages endpoints, preview UI.
**Acceptance criteria:** metadata renders when available; unavailable metadata never blocks transcript extraction.
**Testing requirements:** [TESTING.md](TESTING.md) §K.

---

## Phase 5 — Transcript API and data management

**Objective:** Stable versioned API contract.
**Depends on:** Phases 2–4.

- `[ ]` `POST /api/v1/videos/inspect`
- `[ ]` `POST /api/v1/transcripts`
- `[ ]` Pydantic request/response schemas
- `[ ]` Unified error response shape
- `[ ]` CORS restricted to explicit frontend origin
- `[ ]` Rate limiting, request size limits
- `[ ]` Frontend API client + shared types

**Deliverables:** versioned endpoints, typed client.
**Acceptance criteria:** valid request returns normalized transcript; invalid input returns structured 4xx.
**Testing requirements:** [TESTING.md](TESTING.md) §D, §P, §Q.

---

## Phase 6 — Frontend and transcript workspace

**Objective:** Usable, responsive transcript viewer.
**Depends on:** Phase 5.

- `[ ]` Homepage: hero, URL form, how-it-works, footer
- `[ ]` Loading, empty and error states
- `[ ]` Transcript workspace: timestamped segment list
- `[ ]` Clickable timestamps → video position
- `[ ]` Light and dark themes
- `[ ]` Responsive layout (mobile/tablet/desktop)
- `[ ]` Accessibility pass: keyboard, focus, contrast, ARIA

**Deliverables:** complete viewer per [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) §H–§J.
**Acceptance criteria:** paste URL → readable timestamped transcript on mobile and desktop.
**Testing requirements:** [TESTING.md](TESTING.md) §E, §F, §G.

---

## Phase 7 — Transcript productivity tools

**Objective:** Search, edit and manipulate transcript in-browser.
**Depends on:** Phase 6.

- `[ ]` Client-side search with highlighted matches
- `[ ]` Prev/next match navigation
- `[ ]` Text editing of segments
- `[ ]` Whitespace/format normalization
- `[ ]` Copy all / copy segment / select all
- `[ ]` Character, word and segment counts
- `[ ]` Auto-scroll to active segment
- `[ ]` Optional local recent-history (opt-in only)

**Deliverables:** search and editing controls in the workspace.
**Acceptance criteria:** searching finds and highlights matches; edits persist in session state.
**Testing requirements:** [TESTING.md](TESTING.md) §E, §O.

---

## Phase 8 — Export and download system

**Objective:** Export without an account.
**Depends on:** Phase 7.

- `[ ]` `toTxt`, `toSrt`, `toVtt`, `toMarkdown`, `toPdf`
- `[ ]` Preserve original timestamps
- `[ ]` Reflect user edits in output files
- `[ ]` Copy-to-clipboard
- `[ ]` Export button group with disabled states

**Deliverables:** five exporters + clipboard.
**Acceptance criteria:** SRT/VTT output validates against their formats; TXT/MD are clean; PDF is readable.
**Testing requirements:** [TESTING.md](TESTING.md) §N.

---

## Phase 9 — Testing, security and performance

**Objective:** Verified, hardened, fast.
**Depends on:** Phases 1–8.

- `[ ]` Full backend unit + integration suites green
- `[ ]` Playwright E2E happy path and error paths green
- `[ ]` Security checklist signed off ([SECURITY.md](SECURITY.md) §L)
- `[ ]` SSRF and URL-allowlist tests
- `[ ]` Rate-limit and timeout verification
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
