# Transcora

Free YouTube Transcript Generator — paste a YouTube URL, get a searchable, editable, downloadable transcript. No account, no payment.

## Status

Version 1 and V2 tranches T0–T5 are built, tested and browser-verified; T6 (release hardening) adds Playwright E2E, large-transcript profiling, a clean dependency audit, sitemap/OG metadata and a web app manifest — see [TASKS.md](docs/TASKS.md). Production deployment is the remaining step.

**Features:** paste a YouTube URL → searchable, editable transcript with playback sync, productivity tools (find-replace, filler removal, highlights, notes, bookmarks, reading mode, undo/redo), Gemini AI features on your own browser-side key (summaries, chapters, Q&A, speaker labels), exports (TXT/SRT/VTT/MD/PDF/CSV/DOCX), a browser-local library with TXT/SRT/VTT/MD import, transcript comparison, batch extraction, and shareable read-only links (30-day expiry, no accounts). The transcript engine extracts available captions — it does not transcribe audio.

## Quick start

```bash
# Backend (Python 3.13) — http://localhost:8000
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
$env:DATABASE_URL='sqlite:///./shares.db'   # optional; sharing disabled without it
.venv\Scripts\python -m uvicorn app.main:app --port 8000

# Frontend (Node 22) — http://localhost:3000
cd frontend
npm install
npm run dev
```

Copy `backend/.env.example` / `frontend/.env.example` for environment defaults. Set `NEXT_PUBLIC_SITE_URL` to the deployed origin so sitemap/OG URLs are absolute.

## Tests

```bash
cd frontend && npm run lint && npx tsc --noEmit && npm test && npm run build
cd backend  && python -m pytest
cd frontend && npx playwright test    # E2E; needs both dev servers + live YouTube access
```

Current counts: 114 Vitest, 48 Pytest, 5 Playwright — see [TESTING.md](docs/TESTING.md).

## Project documents

| File | Responsibility |
|---|---|
| [AGENTS.md](AGENTS.md) | How AI coding agents work on this repo |
| [PROJECT.md](docs/PROJECT.md) | Product requirements and the 11-phase roadmap |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System structure and API contract |
| [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | UI tokens, components, accessibility |
| [TASKS.md](docs/TASKS.md) | Progress tracking |
| [TESTING.md](docs/TESTING.md) | Test strategy and commands |
| [DECISIONS.md](docs/DECISIONS.md) | Architecture decision records |
| [SECURITY.md](docs/SECURITY.md) | Security requirements and threat model |
