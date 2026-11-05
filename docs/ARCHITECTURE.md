# ARCHITECTURE.md — System Architecture

Authoritative source for **how the system is structured**. Requirements: [PROJECT.md](PROJECT.md). Decisions: [DECISIONS.md](DECISIONS.md). Rules: [AGENTS.md](../AGENTS.md).

> **Status legend** — **Confirmed:** implemented and verified in this repository. **Proposed:** designed but not yet implemented.
>
> **Repository state (2026-11-03):** Version 1 is built, tested and verified (see [TASKS.md](TASKS.md)). Items are **Confirmed** unless their title says **Proposed** — those are Version 2 designs (share storage, batch/playlist, AI, deployment) that do not exist yet. Do not document a path or module as existing until it does.

## A. High-level architecture

```
User → Next.js frontend → FastAPI backend → Caption provider → YouTube caption tracks
                ↑                  │
                └── normalized transcript JSON ──┘
                │
                └── client-side search / edit / export
```

Two services, one contract: the backend returns a provider-independent transcript shape; the frontend never learns which provider served it.

**V2 (Proposed):** a narrow share store behind `/api/v1/shares` ([ADR-011](DECISIONS.md)) and frontend-driven batch extraction ([ADR-012](DECISIONS.md)) — details in §E and §N.

## B. Frontend architecture — Confirmed

```
frontend/
├── public/
└── src/
    ├── app/                 # App Router pages: layout, page, transcript, about, privacy
    ├── components/
    │   ├── layout/           # Header, footer, theme toggle
    │   ├── url-input/        # URL form + validation feedback
    │   ├── video-preview/    # Title, thumbnail, channel, duration (player fallback)
    │   ├── video-player/     # Embedded YouTube IFrame player (T1)
    │   ├── transcript-viewer/# Timestamped segment list + playback highlight
    │   ├── transcript-search/# Search + highlight
    │   ├── transcript-export/# Export controls
    │   └── ui/               # shadcn/ui primitives
    ├── hooks/                # useTheme, useFontSize (search/edit state lives in the workspace page)
    ├── lib/                  # URL helpers, formatters, export builders, playback sync (binary search)
    ├── services/             # API client
    └── types/                # Video, Transcript, TranscriptSegment
```

- **Transcript workspace** renders segments with clickable timestamps and owns search, editing and export state; on desktop it is a two-pane layout (sticky video | resizable transcript) with follow-playback highlight, keyboard shortcuts and fullscreen.
- **Export modules** are pure functions over the in-memory transcript — no server round-trip.
- **AI modules** are Version 2 only (Phase 10).

## C. Backend architecture — Confirmed

```
backend/
├── app/
│   ├── main.py               # App factory, CORS, middleware, router mount
│   ├── core/                 # config.py, security.py, exceptions.py
│   ├── api/v1/               # router.py, videos.py, transcripts.py (+ shares.py, V2)
│   ├── schemas/              # video.py, transcript.py, common.py (Pydantic) (+ share.py, V2)
│   ├── services/             # video_service.py, transcript_service.py (+ share_service.py, V2)
│   │   ├── providers/        # base.py, youtube_provider.py
│   │   └── storage/          # share_store.py (V2, ADR-011) — shareable transcripts only
│   └── utils/                # url_parser.py, timestamp.py
├── tests/
├── requirements.txt
└── .env.example
```

- **Routers** do validation and HTTP concerns only; no business logic.
- **Services** orchestrate; **providers** talk to YouTube; **utils** hold pure helpers (URL parsing, timestamp conversion).
- **Exception handling** maps domain errors to the safe API error contract in §F.
- **Configuration** comes from environment variables via Pydantic Settings; no secrets in source.

## D. Data flow — Confirmed

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

## E. API endpoints — Confirmed for Version 1; share endpoints Proposed (V2)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Backend health |
| POST | `/api/v1/videos/inspect` | Inspect a video |
| GET | `/api/v1/videos/{id}/languages` | Available caption languages |
| POST | `/api/v1/transcripts` | Extract transcript |
| POST | `/api/v1/shares` | Create shareable transcript link (V2, ADR-011) |
| GET | `/api/v1/shares/{token}` | Fetch a shared transcript (V2, ADR-011) |
| DELETE | `/api/v1/shares/{token}` | Delete a share using its delete token (V2, ADR-011) |

Batch extraction (V2, ADR-012) adds no endpoint: the frontend sequences existing `POST /api/v1/transcripts` calls with delays and per-item results. Playlist enumeration, if the T5 spike approves a method, would add one read-only endpoint whose output IDs are re-validated like user input.

Request:

```json
{ "url": "https://www.youtube.com/watch?v=VIDEO_ID", "language": "en" }
```

## F. Common data models — Confirmed

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

## G. Provider abstraction — Confirmed

`providers/base.py` defines a provider interface (`list_languages`, `fetch_transcript`); `youtube_provider.py` implements it against `youtube-transcript-api`. Services depend only on the interface, so swapping or adding a provider never touches routers or the frontend.

## H. Export architecture — Confirmed

Client-side builders in `frontend/src/lib/export.ts`: `toTxt`, `toSrt`, `toVtt`, `toMarkdown`, `toCsv`, `toDocx`, `toPdf`, plus `buildExport` (async dispatcher returning `{ blob, filename }`) and `filterSegments` (scope: entire transcript vs current search matches). Each takes the normalized `Transcript` plus current edits and `ExportOptions` (timestamps, metadata header, segment/paragraph formatting, filename) and returns a `Blob`/string. Server is uninvolved.

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

## J. Environment configuration — Confirmed for Version 1; `DATABASE_URL` Proposed (V2)

| Variable | Service | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Frontend | Backend base URL |
| `CORS_ORIGINS` | Backend | Explicit frontend origin allowlist |
| `DATABASE_URL` | Backend | Share-store connection; sharing stays disabled when absent (V2, ADR-011) |
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
| Version 1 directories, endpoints, models and export modules | Confirmed — built and verified; see [TASKS.md](TASKS.md) |
| Share store and share endpoints (§N), batch/playlist (ADR-012), AI (§I), deployment (§K) | Proposed — not implemented |
| Test results | 48 frontend + 37 backend tests green — see [TESTING.md](TESTING.md) |

## N. Share storage and bulk extraction — Proposed (V2)

**Share store ([ADR-011](DECISIONS.md)).** One table on a managed Postgres-compatible service, accessed only through `share_store.py`:

```sql
shares(
  token_hash    char(64) primary key,  -- SHA-256 of the share token; raw token never stored
  delete_hash   char(64) not null,     -- SHA-256 of the delete token
  video_id      char(11) not null,
  language_code text,
  created_at    timestamptz not null,
  expires_at    timestamptz not null,  -- created_at + 30 days, indexed for purge
  payload       jsonb not null,        -- normalized Transcript
  bytes         integer not null       -- enforced size cap
)
```

- The only operations are create, get, delete and purge-expired — there is no query by user, because there are no users.
- Unknown or expired tokens return the standard safe 404; a periodic or lazy sweep deletes rows past `expires_at`.
- Connection via `DATABASE_URL` (§J). This store is the only stateful component in the system; everything else remains stateless.

**Batch and playlist ([ADR-012](DECISIONS.md)).** The frontend sequences `POST /api/v1/transcripts` calls (inter-request delay, per-item progress, partial success) — no backend state. Playlist enumeration is a T5 spike (Data API vs Innertube vs yt-dlp); whichever method is chosen, every returned video ID is re-validated against `^[A-Za-z0-9_-]{11}$` before use. Caps: ≤ 20 videos per batch, sequential with delay, one shared per-IP rate budget. Security requirements: [SECURITY.md](SECURITY.md) §N–§O.
