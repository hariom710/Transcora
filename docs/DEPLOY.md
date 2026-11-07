# DEPLOY.md — Deployment Runbook

Deploys Transcora to production: **Vercel** for the Next.js frontend and **Railway** (or **Render**) for the FastAPI backend. No code changes required — the build is already green.

## Prerequisites

- A GitHub account connected to the repo `https://github.com/hariom710/Transcora.git` on `main`.
- Vercel account (frontend).
- Railway or Render account (backend — Python-compatible host with persistent disk if using SQLite, or a Postgres add-on).

## 4 environment variables

| Variable | Service | Example value | Source |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Frontend | `https://transcora-api.up.railway.app` | `frontend/.env.example` |
| `NEXT_PUBLIC_SITE_URL` | Frontend | `https://transcora.vercel.app` | `frontend/.env.example` |
| `CORS_ORIGINS` | Backend | `https://transcora.vercel.app` | `backend/.env.example` |
| `DATABASE_URL` | Backend | `sqlite:///./shares.db` or `postgres://user:pass@host:5432/db` | `backend/.env.example` |

All four must be set at deploy time. Frontend vars are public (never secrets); `DATABASE_URL` is a secret — use the host's secret store, never commit `.env`.

---

## Part 1 — Frontend on Vercel

### Via the Vercel dashboard (recommended)

1. Go to https://vercel.com → **Add New Project** → **Import Git Repository** → select `hariom710/Transcora`.
2. **Framework preset:** Next.js (detected automatically).
3. **Root Directory:** `frontend` (the Next app lives in `/frontend`, not the repo root).
4. **Build Command:** `npm run build` (default).
5. **Output Directory:** `.next` (default).
6. **Install Command:** `npm install` (default).
7. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://<your-backend>.up.railway.app` (or Render URL)
   - `NEXT_PUBLIC_SITE_URL` = `https://<your-app>.vercel.app`
8. Click **Deploy**.

### Via the Vercel CLI

```bash
# From the repo root
cd frontend
npx vercel login
npx vercel --prod
# When prompted: link to existing repo hariom710/Transcora, scope = your team,
# root directory = frontend, override settings = no
# Add env vars in the Vercel project dashboard after the first deploy:
#   NEXT_PUBLIC_API_BASE_URL = https://<backend>.up.railway.app
#   NEXT_PUBLIC_SITE_URL     = https://<frontend>.vercel.app
```

---

## Part 2 — Backend on Railway

### Via the Railway dashboard

1. Go to https://railway.app → **New Project** → **Deploy from GitHub repo** → select `hariom710/Transcora`.
2. **Root directory / service source:** `backend` (the FastAPI app lives in `/backend`).
3. Railway auto-detects Python. **Start command** (service settings → Deploy):
   ```
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
4. Under **Variables**, add:
   - `DATABASE_URL` = `sqlite:///./shares.db` (persistent disk required) or your Postgres connection string
   - `CORS_ORIGINS` = `https://<your-vercel-app>.vercel.app`
   - `PYTHONUNBUFFERED` = `1` (optional, for log streaming)
5. Click **Deploy**. Railway gives you a URL like `https://transcora-api.up.railway.app`.

### Via the Railway CLI

```bash
# From the repo root
npm i -g @railway/cli
railway login
railway init   # select existing project or create new
railway service create backend
cd backend
railway up --detach
railway variable set DATABASE_URL='sqlite:///./shares.db'
railway variable set CORS_ORIGINS='https://<vercel-app>.vercel.app'
railway up
railway open   # shows the service URL
```

### On Render (alternative to Railway)

1. Go to https://render.com → **New → Web Service** → connect `hariom710/Transcora`.
2. **Runtime:** Python 3.13. **Root Dir:** `backend`.
3. **Build Command:** `pip install -r requirements.txt`
4. **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. **Environment Variables:**
   - `DATABASE_URL` = `sqlite:///./shares.db` (use Render Disk for persistence) or Postgres
   - `CORS_ORIGINS` = `https://<vercel-app>.vercel.app`
6. Click **Create Web Service**.

---

## Part 3 — Wire the two together

1. In the **Vercel** project dashboard → Settings → Environment Variables:
   - Set `NEXT_PUBLIC_API_BASE_URL` = `https://<railway-or-render-backend-url>`
   - Set `NEXT_PUBLIC_SITE_URL` = `https://<vercel-app-url>`
   - Click **Save** → **Redeploy** the latest production deployment.
2. Verify cross-origin works: open `https://<vercel-app-url>` in a browser and check the network tab — requests to the backend should not be blocked by CORS.

---

## Part 4 — Post-deploy verification

Run these **after** both services are live.

### A4 — Extract a real transcript from the deployed environment

```bash
curl -X POST https://<backend-url>/api/v1/transcripts \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","language":"en"}'
```

Expected: HTTP 200 with `{"segments":[...], "language":"English", ...}` (≈61 segments).

**Warning (ARCHITECTURE §K):** hosting IPs may be blocked by YouTube. If you get `UPSTREAM_BLOCKED` (503), this is an availability issue — do **not** attempt to circumvent the IP block. Wait for the block to clear or move the backend to a different host/IP.

### §S — Production release checklist

| # | Check | How to verify |
|---|---|---|
| 1 | All suites green in CI | `npm run lint`, `npx tsc --noEmit`, `npx vitest run` (frontend: 137); `pytest` (backend: 48) — all green locally |
| 2 | Full Playwright E2E green against production build | `npx playwright test` against `https://<vercel-url>` (2 live-caption tests need YouTube access — pace ≥75 s) |
| 3 | Real transcript extracted from deployed environment | A4 above — HTTP 200 with segments |
| 4 | Rate limiting, CORS and timeouts active in production | `curl` the backend with an unknown `Origin` → no `access-control-allow-origin`; rapid repeated requests → 429 with `Retry-After` |
| 5 | No secrets in bundle or repository | `.env` is gitignored; only `.env.example` tracked; repo secret scan clean |
| 6 | Light and dark themes verified | Toggle theme on production site; `localStorage` persists |
| 7 | Mobile viewport verified | Open production URL on a phone / Chrome DevTools 375px — no horizontal overflow, 40px touch targets |
| 8 | Error states verified with backend stopped | Stop the backend service temporarily; frontend should show the error card ("Transcript unavailable") + "Try again" |
| 9 | Dependency audit clean | `npm audit` = 0, `pip-audit -r requirements.txt` = none |
| 10 | Share lifecycle verified (create → read → expire → delete) | Save a transcript → share link opens → delete token removes row → unknown/expired token → safe 404 (ADR-011) |

---

## Rollback / troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| CORS error in browser | `CORS_ORIGINS` doesn't include the Vercel URL | Add the exact Vercel origin (no trailing slash) to `CORS_ORIGINS` on the backend, redeploy |
| `UPSTREAM_BLOCKED` 503 | YouTube blocking the host IP | Wait for the block to clear; do not circumvent; consider moving the backend host |
| Share endpoints 503 | `DATABASE_URL` not set | Set `DATABASE_URL` on the backend service, redeploy |
| Build fails on Vercel | Wrong root directory | Set Vercel project root directory to `frontend` |

---

## What NOT to change

- Do **not** add playlist UI — the ADR-012 spike passed but the owner must approve the ToS-sensitive enumeration method first (DECISIONS.md ADR-012).
- Do **not** bundle a Gemini key — users supply their own key client-side (ADR-009).
- Do **not** commit `.env` or real secrets.
