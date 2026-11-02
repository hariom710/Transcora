# PROJECT.md — Overview and Requirements

Authoritative source for **what** we are building. How: [ARCHITECTURE.md](ARCHITECTURE.md). UI: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). Progress: [TASKS.md](TASKS.md).

## A. Product vision

The simplest reliable way to turn a YouTube video into usable text — free, instant, no account.

## B. Problem statement

Useful content is locked inside video. Manually taking notes is slow, rewatching to find one sentence is slower, and YouTube captions are awkward to copy or export. Students, researchers, developers and creators need that text as searchable, editable, downloadable notes.

## C. Target users

Students · developers · researchers · content creators · teachers · journalists · general users.

## D. Product objectives

- Paste a URL, get the transcript in seconds.
- Automatic caption retrieval with language selection.
- Timestamped display, search, editing, copy and multi-format export.
- Clean responsive interface, zero registration.
- Later: optional Gemini-powered AI features.

## E. Functional requirements — Version 1

**Extraction:** YouTube URL input · URL validation · video ID extraction · video metadata (title, thumbnail, channel, duration) · caption detection · manual captions · automatic captions · language detection · language selection · translated caption tracks when available · clear error when captions are unavailable.

Supported URL forms:

```
https://www.youtube.com/watch?v=VIDEO_ID
https://youtu.be/VIDEO_ID
https://www.youtube.com/embed/VIDEO_ID
https://www.youtube.com/shorts/VIDEO_ID
```

**Transcript tools:** timestamped transcript · clickable timestamps · search with highlighted matches · copy all · copy segment · text editing · whitespace normalization · auto-scroll · select all · character/word/segment counts · language display.

**Exports:** TXT · SRT · VTT · Markdown · PDF · copy to clipboard. Exports preserve original timestamps and reflect user edits.

**UX:** minimal homepage · responsive · light and dark modes · loading progress · success and error notifications · optional local recent history · no mandatory registration · no popups · accessible keyboard navigation.

## F. Version 2 AI requirements — planned, not built

AI Summary · Smart Notes · Key Points · Chapter Generator · Ask This Video · Topic Extraction · Learning Notes.

## G. Gemini API key strategy

The user supplies their own free-tier key in an optional AI settings section. The key is handled client-side, never sent to our backend, and never persisted unless the user explicitly opts in. Browser-side keys cannot be fully secret from anyone with access to that browser. Verify current free-tier models, rate limits and pricing before implementing.

## H. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Code-split frontend, client-side search, async endpoints with timeouts, avoid duplicate extraction, virtualize large transcripts |
| Reliability | Clear errors for missing captions, private/restricted videos and blocked requests |
| Security | URL allowlist, no SSRF, rate limiting, safe errors, explicit CORS — see [SECURITY.md](SECURITY.md) |
| Accessibility | Keyboard navigation, focus states, semantic HTML, sufficient contrast |
| Privacy | No account, no unnecessary storage, no full-transcript logging |
| Maintainability | Modular services, shared types, automated tests |
| Scalability | Stateless backend; optional short-lived cache |

## I. Product limitations

- Videos without accessible captions cannot be transcribed by this engine.
- Private and restricted videos are generally inaccessible.
- YouTube may block automated requests from certain IPs or regions.
- Language availability and translation depend on the video.
- Free hosting has sleep, request and resource limits.
- Gemini free-tier quotas may change.

Speech-to-text for caption-less videos is explicitly out of scope — it needs separate authorized audio processing with its own cost.

## J. Out of scope

User accounts · database · payments · video/audio upload · audio transcription · bypassing YouTube access controls · desktop app · mobile app · multi-video batching · playlist extraction.

## K. Roadmap — 11 phases

| # | Phase | Deliverable |
|---|---|---|
| 1 | Project initialization | Frontend + backend scaffold, tooling, CI-ready test setup |
| 2 | YouTube URL processing | URL parser, video ID extraction, validation tests |
| 3 | Transcript extraction engine | Caption provider, extraction, normalization |
| 4 | Video metadata and language management | Video preview, language detection and selection |
| 5 | Transcript API and data management | Versioned endpoints, schemas, error contract |
| 6 | Frontend and transcript workspace | Timestamped viewer, responsive UI, themes |
| 7 | Transcript productivity tools | Search, highlight, editing, copy, counts |
| 8 | Export and download system | TXT, SRT, VTT, Markdown, PDF |
| 9 | Testing, security and performance | Full suites, hardening, large-transcript profiling |
| 10 | Gemini AI integration | AI summaries, notes, chapters, Q&A |
| 11 | Deployment and final release | Production deploy, verification, launch |

Detailed tasks and acceptance criteria: [TASKS.md](TASKS.md).
