# DECISIONS.md — Architecture Decision Records

Authoritative record of **why** technical choices were made. Structure: [ARCHITECTURE.md](ARCHITECTURE.md). Rules: [AGENTS.md](../AGENTS.md).

**Status values:** `Accepted` · `Proposed` · `Superseded`.

New architectural changes are recorded here — never made silently. Decisions below originate from the project specification dated **November 2026**; no historical decision dates are known beyond that, and none are invented.

---

## ADR-001 — Next.js + TypeScript for frontend

- **Status:** Accepted
- **Context:** Need a modern, responsive UI with type safety and a free hosting path.
- **Decision:** Build the frontend with Next.js (App Router) and TypeScript in strict mode.
- **Alternatives considered:** plain React + Vite (no SSR/routing conventions); Vue/Svelte (team familiarity, ecosystem fit).
- **Consequences:** Vercel free-tier hosting, shared types, code splitting. Requires Node 22-compatible tooling.
- **Date:** November 2026 (specification).

## ADR-002 — FastAPI for backend

- **Status:** Accepted
- **Context:** Caption extraction is a Python ecosystem strength; the API must be async, typed and cheap to host.
- **Decision:** Python + FastAPI + Pydantic + HTTPX as a separate backend service.
- **Alternatives considered:** Next.js API routes only (would require a JavaScript caption library); serverless Python functions per request.
- **Consequences:** Two services to deploy and configure; explicit CORS; a Python-compatible host is required. Enables `youtube-transcript-api` and Pytest reuse.
- **Date:** November 2026 (specification).

> **Conflict resolved (November 2026):** an earlier working discussion proposed collapsing both services into a single Next.js app using the `youtube-transcript` npm package. The specification and [AGENTS.md](../AGENTS.md) §B both mandate the FastAPI backend, so this ADR stands as written and the single-service proposal is rejected. Built and verified as two services.

## ADR-003 — youtube-transcript-api for initial caption extraction

- **Status:** Accepted
- **Context:** Need reliable access to available caption tracks (manual and automatic) without building scraping infrastructure.
- **Decision:** Use `youtube-transcript-api` behind a provider abstraction (`providers/base.py`).
- **Alternatives considered:** direct InnerTube scraping (fragile, higher maintenance); paid transcription APIs (violates free-first principle); YouTube Data API captions endpoint (does not return caption text).
- **Consequences:** Depends on an unofficial interface that can change without notice; YouTube may block requests from datacenter IPs. The provider interface keeps the engine swappable. We do not bypass access controls.
- **Date:** November 2026 (specification).

## ADR-004 — No database in Version 1

- **Status:** Accepted
- **Context:** The product has no accounts and no server-side transcript persistence.
- **Decision:** Keep transcripts in frontend state; optional browser-local recent history only.
- **Alternatives considered:** Postgres/SQLite for history (adds infra, cost, privacy surface); Redis cache (defer until measurement proves a need).
- **Consequences:** Less infrastructure, cost, maintenance and privacy risk. History is per-device and clearable; no cross-device sync.
- **Date:** November 2026 (specification).

## ADR-005 — No mandatory authentication

- **Status:** Accepted
- **Context:** Registration is the biggest barrier for a free utility.
- **Decision:** No login, no account, no subscription in Version 1.
- **Alternatives considered:** optional magic-link login (adds email infra); OAuth (adds providers and privacy review).
- **Consequences:** No user records to protect; abuse must be handled by rate limiting instead of account controls. Payments and profiles are out of scope.
- **Date:** November 2026 (specification).

## ADR-006 — Client-side transcript search and editing

- **Status:** Accepted
- **Context:** The full transcript is already in the browser; round-tripping it for search wastes latency and exposes content unnecessarily.
- **Decision:** Search, highlight, editing and counts run entirely in the browser.
- **Alternatives considered:** server-side search (requires transcript re-upload or storage); an index service (no database per ADR-004).
- **Consequences:** Instant results, zero extra privacy exposure, no backend cost. Very large transcripts must render efficiently (virtualization if profiling demands it).
- **Date:** November 2026 (specification).

## ADR-007 — Client-side export where practical

- **Status:** Accepted
- **Context:** Export formats are deterministic transformations of data already held client-side.
- **Decision:** Generate TXT, SRT, VTT, Markdown and PDF in the browser.
- **Alternatives considered:** backend export endpoints (server cost, transcript leaves the browser, extra latency).
- **Consequences:** No server load, works offline after load, exports reflect current edits. PDF generation adds a client dependency — weigh against the minimal-dependency rule before adding one.
- **Date:** November 2026 (specification).

## ADR-008 — Gemini integration in Version 2

- **Status:** Accepted
- **Context:** AI features are valuable but must not delay a reliable core product.
- **Decision:** Ship transcript extraction first; add Gemini features as Phase 10 only after Phases 1–9 are complete and verified.
- **Alternatives considered:** building both simultaneously (risks an unreliable core); a different AI provider (revisit if free-tier terms change).
- **Consequences:** No AI code exists or should exist before Phase 10. Scope creep here is a governance violation — see [AGENTS.md](../AGENTS.md) §G.
- **Date:** November 2026 (specification).

## ADR-009 — Optional user-provided Gemini API key

- **Status:** Accepted
- **Context:** The project is free-first and must not carry paid AI costs or hold user secrets.
- **Decision:** The user supplies their own free-tier key. It is handled client-side, never sent to our backend, and persisted only on explicit opt-in.
- **Alternatives considered:** a developer-owned key (cost exposure, abuse risk, key leakage in a public bundle); a backend proxy (would hold a secret and receive user transcripts).
- **Consequences:** Users must obtain a key to use AI features. Browser-side keys are visible to anyone with access to that browser — this limitation must be disclosed in the UI. Key never appears in our source or logs.
- **Date:** November 2026 (specification).

## ADR-010 — Free-first product strategy

- **Status:** Accepted
- **Context:** Target users are students, developers and researchers who want zero-friction access.
- **Decision:** Free to use, no mandatory login, no mandatory subscription, minimal dependencies and resource use.
- **Alternatives considered:** freemium tiers (adds billing and gating); ads (degrades a productivity tool).
- **Consequences:** Monetization deferred indefinitely. Free hosting limits apply (ADR-004 reduces them). Any future paid offering requires a new ADR.
- **Date:** November 2026 (specification).

---

## Change log

Record superseding decisions here with their new ID, status `Superseded` on the original, and a date actually known. Do not backdate.
