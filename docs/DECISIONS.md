# DECISIONS.md — Architecture Decision Records

Authoritative record of **why** technical choices were made. Structure: [ARCHITECTURE.md](ARCHITECTURE.md). Rules: [AGENTS.md](../AGENTS.md).

**Status values:** `Accepted` · `Proposed` · `Superseded`.

New architectural changes are recorded here — never made silently. The original decisions below originate from the project specification dated **November 2026**; no historical decision dates are known beyond that, and none are invented. Later decisions (ADR-011 onward) carry their actual dates.

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

- **Status:** Superseded (2026-11-03) by ADR-011
- **Superseded note:** ADR-011 permits a database **exclusively** for shareable transcripts and their lifecycle. All other provisions of this decision remain in force: transcripts otherwise stay in frontend state, with browser-local history only.
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
- **Decision:** Generate TXT, SRT, VTT, Markdown, CSV, DOCX and PDF in the browser (CSV/DOCX added for V2 tranche T2, November 2026).
- **Alternatives considered:** backend export endpoints (server cost, transcript leaves the browser, extra latency).
- **Consequences:** No server load, works offline after load, exports reflect current edits. Two client dependencies serve this: `jspdf` (PDF) and `docx` v9.15.1, MIT (real .DOCX — a ZIP/OOXML package cannot be hand-rolled within the minimal-code rule).
- **Date:** November 2026 (specification; CSV/DOCX decision 2026-11-03).

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

## ADR-011 — Database limited to shareable transcript links

- **Status:** Accepted
- **Context:** The owner-approved V2 roadmap includes shareable transcript links — a visitor creates a link anyone can open without an account. That requires server-side persistence, which ADR-004 forbade. ADR-005 (no mandatory authentication) and ADR-009 (browser-side Gemini keys) are explicitly preserved and unaffected by this decision.
- **Decision:** Introduce a database **exclusively** for shareable transcripts and their lifecycle: create, read, expire, delete. Nothing else is persisted server-side — no accounts, no submitted URLs, no viewing history, no transcript stored unless the user explicitly publishes it as a share. ADR-004 is superseded to this extent only; every other aspect of it stands.
- **Storage:** one relational table on a managed Postgres-compatible free-tier service; final vendor decided together with the hosting choice at implementation time. SQLite only if the host guarantees persistent disk. Schema: [ARCHITECTURE.md](ARCHITECTURE.md) §N.
- **Link mechanics:** share tokens are ≥ 128-bit CSPRNG values stored as SHA-256 hashes (a database dump yields no working links); each creation returns a separate one-time delete token; default expiry is 30 days; creation is an explicit per-transcript user action with in-product disclosure. Full operational requirements: [SECURITY.md](SECURITY.md) §N.
- **Alternatives considered:** stateless transcript-encoded-in-URL sharing (no database, but transcript sizes exceed practical URL limits, and there is no expiry or revocation); account-based sharing (violates ADR-005); KV/blob store (workable, rejected to keep a single data store and one backup story); keeping ADR-004 and dropping the feature (the feature is explicitly approved).
- **Consequences:** first server-side user content in the system — [PROJECT.md](PROJECT.md) §J, [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md) §N/§G and [TESTING.md](TESTING.md) §U are updated alongside this ADR; per-IP creation rate limits, body-size caps, expiry purge and deletion must all actually run; the Privacy page must disclose stored shares. ADR-005 unchanged: shares are anonymous capability links, not accounts.
- **Date:** 2026-11-03

## ADR-012 — Playlist and batch processing

- **Status:** Accepted
- **Context:** Multi-video batching and playlist extraction were excluded in PROJECT.md §J. Both were approved for V2 on 2026-11-03, subject to feasibility and abuse constraints — they are the highest-abuse-risk features in the roadmap because they multiply traffic against YouTube through one shared rate limit.
- **Decision:**
  - **Batch (multiple video URLs):** ship it. The frontend drives sequential extraction through the existing `POST /api/v1/transcripts` contract, with an inter-request delay, per-item results and partial success. No queue, no new backend state — the backend stays stateless.
  - **Playlist:** spike first, ship only if the spike passes review. `youtube-transcript-api` fetches captions per video only and cannot enumerate playlist items. If no method passes, playlist stays unsupported and documented; batch covers most of the value by accepting pasted URLs.
- **Feasibility research (recorded 2026-11-03):**

  | Method | Assessment |
  |---|---|
  | `youtube-transcript-api` | No playlist enumeration — documented limitation, not viable |
  | YouTube Data API `playlistItems` | Viable; requires a Google Cloud key (new secret) and a daily quota budget |
  | Innertube `browse` calls | Viable; unofficial, may break without notice, ToS-sensitive |
  | `yt-dlp` | Viable; robust but a heavy Python dependency with a maintenance burden |

  Method choice is deferred to the T5 spike; whichever is chosen it must satisfy the security constraints below.
- **Security constraints (binding regardless of method):** SSRF rules unchanged ([SECURITY.md](SECURITY.md) §C — a user-supplied URL is never fetched; only validated IDs leave the service); every video ID, including any returned by playlist enumeration, re-validated against `^[A-Za-z0-9_-]{11}$` before use — enumeration output is untrusted input; batch capped at 20 videos per submission; sequential extraction with inter-request delay; bounded overall timeout; one shared per-IP rate budget across the whole batch so a batch is never a rate-limit loophole; partial failure returns explicit per-item results, never a silently mixed transcript. Details: [SECURITY.md](SECURITY.md) §O.
- **Alternatives considered:** server-side job queue (state, cost and abuse surface disproportionate to a free tool); parallel fan-out (burst traffic invites blocking); dropping the feature (explicitly approved by the project owner).
- **Consequences:** PROJECT.md §J updated; rate-limit budget must account for bulk submissions; partial-failure UX is mandatory; playlist support is contingent on the spike, not committed.
- **Date:** 2026-11-03

---

## Change log

Record superseding decisions here with their new ID, status `Superseded` on the original, and a date actually known. Do not backdate.

- **2026-11-03** — ADR-011 supersedes ADR-004: a database is permitted, scoped exclusively to shareable transcripts and their lifecycle. ADR-005 (no mandatory authentication) and ADR-009 (browser-side Gemini keys) explicitly reaffirmed and unchanged.
- **2026-11-03** — ADR-012 accepts playlist and batch processing, previously excluded by PROJECT.md §J; playlist support contingent on a feasibility spike.
