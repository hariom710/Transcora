# SECURITY.md — Security Requirements

Mandatory security requirements. Rules: [AGENTS.md](AGENTS.md) · Architecture: [ARCHITECTURE.md](ARCHITECTURE.md) · Tests: [TESTING.md](TESTING.md) §Q.

> **Status: Proposed — nothing is implemented yet.** This is the specification the code must satisfy. The verification checklist in §L is signed off only after the checks actually run.

## A. Security principles

- Deny by default: only explicitly allowed destinations and inputs are accepted.
- Never trust user input — validate at the boundary, on the server, every time.
- Least privilege: no auth, no database and no storage means less to protect.
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
- Do not store submitted URLs or transcripts server-side beyond request handling.
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

- Keep dependencies minimal ([AGENTS.md](AGENTS.md) §C) — every package is attack surface.
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

**Explicitly out of scope and prohibited:** bypassing YouTube restrictions, downloading inaccessible content, evading IP blocks, or any circumvention of access controls.
