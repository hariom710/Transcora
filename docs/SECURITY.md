# SECURITY.md — Security Requirements

Mandatory security requirements. Rules: [AGENTS.md](../AGENTS.md) · Architecture: [ARCHITECTURE.md](ARCHITECTURE.md) · Tests: [TESTING.md](TESTING.md) §Q.

> **Status: living specification.** Version 1 controls are implemented and covered by tests ([TESTING.md](TESTING.md) §Q); the §L checklist is signed off item-by-item only after each check actually runs — the full review has not been run. Sections §N–§O specify Version 2 features ([ADR-011](DECISIONS.md), [ADR-012](DECISIONS.md)) that are not built yet.

## A. Security principles

- Deny by default: only explicitly allowed destinations and inputs are accepted.
- Never trust user input — validate at the boundary, on the server, every time.
- Least privilege: no authentication and no user accounts; the only server-side store is shareable transcripts scoped to their lifecycle ([ADR-011](DECISIONS.md), §N) — everything else stays in the browser.
- Fail safe: errors are generic to users, specific only in server logs.
- Never bypass YouTube's access controls or restrictions, and never fetch content a user could not access themselves.

## B. YouTube URL validation

- **Explicit domain allowlist** — only `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`. Everything else is rejected, including look-alike hosts (`youtube.com.evil.com`, `notyoutube.com`).
- **Supported patterns:** `/watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`.
- **Strict video ID validation** — must match `^[A-Za-z0-9_-]{11}$`. Reject anything else before any network call.
- **Reject arbitrary external URLs** — a submitted URL is never fetched; only the extracted ID is used to query the caption provider.
- Validate on **both** client and server. Client-side validation is UX only; the server is the enforcement point.

## C. SSRF prevention

- Never fetch a user-supplied URL. Outbound requests go only to the caption provider's fixed endpoints, parameterized by a validated video ID.
- Restrict outbound destinations; do not honour redirects to unvalidated hosts.
- Do not follow untrusted redirects without re-validation.
- Never accept scheme, host or path from the user as a request target.

## D. API security

| Control | Requirement |
|---|---|
| Request size limits | Reject oversized bodies (JSON body cap at the reverse proxy and app layer) |
| Rate limiting | Per-IP limit with `429` and `Retry-After`; strict enough to deter scripted abuse |
| Timeouts | Bounded connect/read timeouts on every outbound call |
| Concurrency limits | Cap simultaneous upstream requests per instance |
| Safe error responses | `{ "error": { "code", "message" } }` only — no stack traces, paths, library versions or provider internals |
| CORS | Explicit frontend origin allowlist; no wildcard `*` with credentials; credentials unused entirely |

## E. Input validation

- Pydantic models on every request body and query parameter; reject unknown fields where practical.
- Language codes validated against a known pattern, not interpolated into provider calls unchecked.
- Length limits on all strings.
- No `eval`, no dynamic code execution, no shell invocation built from user input.

## F. XSS prevention

- Treat transcript text as **untrusted content** — captions are attacker-influenceable.
- Render as text through React's default escaping. Never use `dangerouslySetInnerHTML` on transcript, title, channel or error content.
- No `innerHTML`, no unsanitized markdown-to-HTML pipeline for transcript data.
- Set a Content-Security-Policy restricting script sources; disallow inline scripts where feasible.
- Downloads: serve exports as `Blob`s with safe filenames — sanitize filenames to prevent path traversal.

## G. Privacy

- No mandatory account and no collection of personal information.
- Do not store submitted URLs or transcripts server-side beyond request handling — **except** a transcript the user explicitly publishes as a shareable link ([ADR-011](DECISIONS.md), §N), which is stored only until expiry or deletion.
- Sharing requires explicit consent in-product: a clear statement that the transcript becomes readable by anyone holding the link, that it is stored on our server, when it expires and how to delete it. Sharing is opt-in per transcript, never the default and never automatic.
- Shared transcript pages are excluded from search engines (`noindex` header plus robots rules).
- Do not log full transcript contents; log metadata only (video ID, status, duration).
- Retain logs briefly; no third-party analytics on transcript content.
- Explain plainly in-product that the tool extracts existing captions and does not transcribe audio.

## H. Gemini API security (Phase 10)

- **Never ship a developer-owned private key in frontend source.** A key bundled for the client is public — treat it as compromised by design.
- User-provided keys are handled **client-side only** and are never sent to our backend, never logged, never written to any server.
- **Disclose browser-side exposure:** anyone with access to the browser (extensions, shared machine, malware) can read a stored key. This limitation must be stated in the AI settings UI, not buried.
- **Persist only on explicit opt-in**, with a visible "forget key" action. Default is memory-only.
- Send a transcript to the AI only after a clear, deliberate user action — never automatically on load.
- Validate model responses before rendering; never render AI output as HTML.
- Handle missing key, invalid key, quota exhaustion and timeout as safe, distinct error states.

## I. Dependency security

- Keep dependencies minimal ([AGENTS.md](../AGENTS.md) §C) — every package is attack surface.
- Pin versions in lockfiles; review new dependencies before adding.
- Run an audit before release (`npm audit`, `pip-audit` or equivalent) and act on high-severity findings.
- Remove unused dependencies rather than leaving them dormant.

## J. Environment variable protection

- Secrets live in environment variables or the host's secret store — never in source, never in `.env` committed to Git.
- Ship `.env.example` with placeholder values only.
- Frontend variables are public by definition: never place a secret in `NEXT_PUBLIC_*`.
- Rotate any key that is ever committed.

## K. Deployment security

- HTTPS everywhere; HSTS enabled.
- CORS origins and rate limits configured identically in production.
- Backend host firewall limits egress to required destinations.
- Errors in production are generic; detail goes to restricted logs.
- Test extraction from the real deployment environment before launch — hosting IPs may be blocked by YouTube (availability, not a security bypass; never attempt to circumvent it).

## L. Security verification checklist

- [ ] Domain allowlist rejects look-alike hosts (server-side test)
- [ ] Video ID pattern enforced before any outbound call
- [ ] No outbound request to any user-supplied URL (SSRF test)
- [ ] Rate limit returns `429` under sustained load
- [ ] Request size limit rejects oversized bodies
- [ ] Timeouts and concurrency caps active
- [ ] Error responses contain no internals
- [ ] CORS rejects unknown origins
- [ ] Transcript text with HTML/script payload renders as text
- [ ] Export filenames sanitized
- [ ] No secrets in source, bundle or repository
- [ ] Transcript contents absent from logs
- [ ] Gemini key never leaves the browser (Phase 10)
- [ ] Dependency audit free of high-severity findings
- [ ] Share tokens ≥ 128-bit CSPRNG, stored only as hashes (ADR-011, §N)
- [ ] Expired share indistinguishable from missing; expiry purge runs (§N)
- [ ] Share creation rate-limited and body size capped — 429/413 verified (§N)
- [ ] Share logs contain no transcript content and no full tokens (§N)
- [ ] Batch capped at 20, sequential, one shared per-IP rate budget (ADR-012, §O)

## M. Threat model and mitigations

| Threat | Vector | Mitigation |
|---|---|---|
| SSRF | Crafted URL in API request | Allowlist + ID regex; server-side only ([§B](#b-youtube-url-validation), [§C](#c-ssrf-prevention)) |
| XSS via captions | Malicious caption text | React text rendering, CSP, no HTML injection ([§F](#f-xss-prevention)) |
| API abuse / scraping | Scripted request floods | Rate limiting, size limits, concurrency caps ([§D](#d-api-security)) |
| Credential leak | Key committed or bundled | Env-only secrets, no client-bundled keys, rotation ([§J](#j-environment-variable-protection)) |
| Data exposure via AI | Transcripts sent offsite | Explicit opt-in action, client-side key, clear disclosure ([§H](#h-gemini-api-security-phase-10)) |
| Dependency compromise | Typosquatting, vulnerable package | Minimal deps, pinned lockfiles, audit ([§I](#i-dependency-security)) |
| Information disclosure | Verbose errors, logging | Unified safe errors, metadata-only logs ([§D](#d-api-security), [§G](#g-privacy)) |
| Redirect-based SSRF | Provider redirect to hostile host | No unvalidated redirect following ([§C](#c-ssrf-prevention)) |
| Share-token guessing | Enumerating `/api/v1/shares/{token}` | 128-bit CSPRNG tokens, hashed at rest, creation rate-limited ([§N](#n-shareable-transcript-security-v2-adr-011)) |
| Share storage abuse | Flooding the creation endpoint | Stricter per-IP bucket, 1 MiB cap, 30-day TTL purge ([§N](#n-shareable-transcript-security-v2-adr-011)) |
| Non-consensual publication | Transcript shared without user intent | Explicit per-transcript action with disclosure, `noindex` ([§G](#g-privacy), [§N](#n-shareable-transcript-security-v2-adr-011)) |
| Bulk extraction abuse | Batch used as a rate-limit loophole | ≤ 20 items, sequential with delay, shared budget ([§O](#o-bulk-extraction-security-v2-adr-012)) |

**Explicitly out of scope and prohibited:** bypassing YouTube restrictions, downloading inaccessible content, evading IP blocks, or any circumvention of access controls.

## N. Shareable transcript security (V2, ADR-011)

Implemented and verified in T5 (2026-11-05); the controls below were the acceptance criteria and are now the binding spec.

| Control | Requirement |
|---|---|
| Token entropy | Share and delete tokens ≥ 128 bits from a CSPRNG (`secrets` module), URL-safe encoding. Store only SHA-256 hashes — a database dump yields no working links. Never derive tokens from video IDs, timestamps or anything predictable; never reuse a token. |
| Expiration | Default TTL 30 days from creation, stored as `expires_at` and indexed. Expired and unknown tokens return the standard safe 404 — identical responses, no enumeration oracle. Rows removed by a periodic or lazy sweep; no rows linger past expiry. |
| Deletion | Every creation returns a one-time delete token, shown once to the creator. Deletion requires it; wrong or missing token → safe 404/403. Deletion removes the row immediately — no recovery, by design. |
| Rate limits | Dedicated stricter per-IP bucket for creation (target 10/hour and 50/day per IP, tunable) on top of the global limiter; reads share the global limit. `429` with `Retry-After` per §D. |
| Body-size limits | Creation body capped at 1 MiB at both reverse proxy and app layer (Pydantic), plus per-field limits (segment count, text length) per §E. Oversized → 413 with the safe error shape. |
| Privacy consent | Sharing is an explicit per-transcript action with in-product disclosure: stored server-side, readable by anyone holding the link, expires in 30 days, deletable with the delete token. Never share automatically; never pre-select sharing. Share pages send `noindex` and are excluded in robots rules. |
| Safe logging | Metadata only: truncated token prefix (≤ 8 chars) or token hash, video ID, byte size, created/expires timestamps, outcome. Never log transcript content, full share tokens or delete tokens. Retention per §G. |
| Abuse control | Creation requires a valid extracted transcript first — the endpoint is not a free-form dump. Shared content is untrusted (§F applies to the read view). The feature must be disableable by configuration if abused. |

## O. Bulk extraction security (V2, ADR-012)

Batch implemented in T5 under these rules; the playlist clause stays binding for any future playlist UI.

- Batch submissions capped at 20 videos; playlist results capped likewise. Sequential extraction with an inter-request delay and a bounded overall timeout.
- One shared per-IP rate budget across the whole batch — a batch must never become a rate-limit loophole.
- Partial failure returns explicit per-item results (success or error code per video), never a silently mixed or truncated transcript.
- SSRF rules (§C) unchanged: batch and playlist input is never fetched as a URL; only validated video IDs leave the service. IDs returned by playlist enumeration are re-validated against `^[A-Za-z0-9_-]{11}$` before use — enumeration output is untrusted input.
- The playlist enumeration method must pass the ADR-012 spike review before shipping; no method may weaken §B or §C.
