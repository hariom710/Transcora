# ARCHITECTURE.md — System Architecture

Authoritative source for **how the system is structured**. Requirements: [PROJECT.md](PROJECT.md). Decisions: [DECISIONS.md](DECISIONS.md). Rules: [AGENTS.md](../AGENTS.md).

> **Status legend** — **Confirmed:** implemented and verified in this repository. **Proposed:** designed but not yet implemented.
>
> **Repository state: no application source code exists yet.** Every architecture item below is **Proposed**. Nothing is Confirmed beyond the development environment (Windows, Node 22, Python 3.13, Git). Do not document a path or module as existing until it does.

## A. High-level architecture

```
User → Next.js frontend → FastAPI backend → Caption provider → YouTube caption tracks
                ↑                  │
                └── normalized transcript JSON ──┘
                │
                └── client-side search / edit / export
```

Two services, one contract: the backend returns a provider-independent transcript shape; the frontend never learns which provider served it.

## B. Frontend architecture — Proposed

```
frontend/
├── public/
└── src/
    ├── app/                 # App Router pages: layout, page, transcript, about, privacy
    ├── components/
    │   ├── layout/           # Header, footer, theme toggle
    │   ├── url-input/        # URL form + validation feedback
    │   ├── video-preview/    # Title, thumbnail, channel, duration
    │   ├── transcript-viewer/# Timestamped segment list
    │   ├── transcript-search/# Search + highlight
    │   ├── transcript-export/# Export controls
    │   └── ui/               # shadcn/ui primitives
    ├── hooks/                # useTranscript, useSearch, useExport, useTheme
    ├── lib/                  # URL helpers, formatters, export builders
    ├── services/             # API client
    └── types/                # Video, Transcript, TranscriptSegment
```

- **Transcript workspace** renders segments with clickable timestamps and owns search, editing and export state.
- **Export modules** are pure functions over the in-memory transcript — no server round-trip.
- **AI modules** are Version 2 only (Phase 10).

## C. Backend architecture — Proposed

```
backend/
├── app/
│   ├── main.py               # App factory, CORS, middleware, router mount
│   ├── core/                 # config.py, security.py, exceptions.py
│   ├── api/v1/               # router.py, videos.py, transcripts.py
│   ├── schemas/              # video.py, transcript.py, common.py (Pydantic)
│   ├── services/             # video_service.py, transcript_service.py
│   │   └── providers/        # base.py, youtube_provider.py
│   └── utils/                # url_parser.py, timestamp.py
├── tests/
├── requirements.txt
└── .env.example
```

- **Routers** do validation and HTTP concerns only; no business logic.
- **Services** orchestrate; **providers** talk to YouTube; **utils** hold pure helpers (URL parsing, timestamp conversion).
- **Exception handling** maps domain errors to the safe API error contract in §F.
- **Configuration** comes from environment variables via Pydantic Settings; no secrets in source.

## D. Data flow — Proposed

1. User submits a YouTube URL.
2. Frontend sends `POST /api/v1/transcripts`.
3. Backend validates the URL against the domain allowlist.
4. Backend extracts the video ID.
5. Metadata retrieved when accessible (private/unavailable handled gracefully).
6. Caption tracks detected, with language info.
7. Selected transcript extracted.
8. Normalized into the common shape (§F).
9. Frontend renders timestamped segments.
10. User searches, edits or exports — all client-side.

## E. API endpoints — Proposed

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Backend health |
| POST | `/api/v1/videos/inspect` | Inspect a video |
| GET | `/api/v1/videos/{id}/languages` | Available caption languages |
| POST | `/api/v1/transcripts` | Extract transcript |

Request:

```json
{ "url": "https://www.youtube.com/watch?v=VIDEO_ID", "language": "en" }
```

## F. Common data models — Proposed

```ts
interface Video {
  id: string;
  title?: string;
  channel?: string;
  thumbnail_url?: string;
  duration?: number;
  url: string;
}

interface TranscriptSegment {
  id: number;
  start: number;
  duration: number;
  text: string;
}

interface Transcript {
  video_id: string;
  language: string;
  language_code: string;
  is_generated: boolean;
  segments: TranscriptSegment[];
}
```

API error response:

```json
{ "error": { "code": "CAPTIONS_UNAVAILABLE", "message": "Safe, non-technical message." } }
```

## G. Provider abstraction — Proposed

`providers/base.py` defines a provider interface (`list_languages`, `fetch_transcript`); `youtube_provider.py` implements it against `youtube-transcript-api`. Services depend only on the interface, so swapping or adding a provider never touches routers or the frontend.

## H. Export architecture — Proposed

Client-side builders in `frontend/src/lib/`: `toTxt`, `toSrt`, `toVtt`, `toMarkdown`, `toPdf`. Each takes the normalized `Transcript` plus current edits and returns a `Blob`/string. Server is uninvolved.

## I. Gemini integration — Proposed, Phase 10

```
Transcript → AI module → Gemini API client → Gemini model
                                      ├─ Summary
                                      ├─ Smart Notes
                                      ├─ Chapters
                                      ├─ Key Points
                                      └─ Questions & Answers
```

Runs in the browser against the user's own key. See [SECURITY.md](SECURITY.md) §H.

## J. Environment configuration — Proposed

| Variable | Service | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Frontend | Backend base URL |
| `CORS_ORIGINS` | Backend | Explicit frontend origin allowlist |
| `GEMINI_API_KEY` | — | Never used server-side; user-supplied client-side only |

## K. Deployment architecture — Proposed

Visitors → Vercel (Next.js) → Python host (FastAPI) → YouTube caption retrieval.

Verify before launch: backend free-tier sleep and request limits, and whether the host's IPs are blocked by YouTube. Test extraction from the real deployment environment before announcing publicly.

## L. Performance considerations — Proposed

- Next.js code splitting; efficient segment rendering (virtualize if a transcript has thousands of segments).
- Client-side search; async endpoints with timeouts; avoid duplicate extraction.
- Optional short-lived cache; exports generated client-side.
- Dependencies kept to the minimum required.

## M. Confirmed vs proposed summary

| Item | Status |
|---|---|
| Development environment (Windows, Node 22, Python 3.13, Git) | Confirmed |
| All directories, modules, endpoints and models above | Proposed — not implemented |
| Test results | None exist yet — see [TESTING.md](TESTING.md) |
