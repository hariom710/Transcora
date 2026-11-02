# AGENTS.md — AI Coding Rules

Governing rules for every AI coding agent working on this repository.

Hierarchy when instructions conflict: **security → [DECISIONS.md](DECISIONS.md) → [ARCHITECTURE.md](ARCHITECTURE.md) → [PROJECT.md](PROJECT.md) → [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)**.

Read only the documents relevant to the current task. Never load all seven by default.

---

## A. Project identity

**Free YouTube Transcript Generator** — a free, lightweight, fast web app that turns available YouTube captions into searchable, editable, downloadable text.

- No mandatory registration, subscription or payment.
- No database and no authentication in Version 1.
- Privacy-conscious, minimal dependencies, minimal resource use.
- Full product definition: [PROJECT.md](PROJECT.md).

## B. Stack and architectural boundaries

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Python, FastAPI, Pydantic, HTTPX, youtube-transcript-api |
| Testing | Pytest, Playwright |
| Future AI | Google Gemini API, user-supplied key, browser-side |
| Deployment | Vercel (frontend) + Python-compatible host (backend) |
| Database | None in Version 1 |

Boundaries:

- Backend never fetches arbitrary user-supplied URLs. See [SECURITY.md](SECURITY.md).
- Transcript search, editing and export run client-side where practical.
- No AI code before Phase 10. No speculative features, ever.
- The transcript engine **extracts existing captions**; it does not transcribe audio.

## C. Mandatory coding principles

- Clean, readable code; simple implementations; no overengineering.
- No duplicated code — reuse existing utilities, hooks and components.
- Strict TypeScript. No `any` without a documented reason.
- Python type hints on all signatures; Pydantic at every API boundary.
- Proper exception handling — never swallow errors silently.
- Modular architecture: routes → services → providers → utils.
- Minimal dependencies. Add a package only when the task genuinely requires it.

## D. Token optimization rules

- Inspect only relevant files. Never read the whole repository.
- Never rewrite a complete file for a small change. Prefer minimal diffs.
- Reuse existing implementations instead of describing new ones.
- Do not print complete source files in responses.
- Avoid unnecessary explanations, repeated summaries and unrequested documentation.
- Do not implement speculative code "for later".
- Run targeted tests first; only then the full suite.
- Do not modify unrelated files. Do not re-inspect unchanged files.
- Do not install packages that are not required.
- Report concise implementation summaries.

## E. Ponytail integration

Use the existing Ponytail installation. Supported modes only:

| Mode | Use for |
|---|---|
| `lite` | Simple changes, UI adjustments, small refactoring |
| `full` | Normal feature implementation and integration |
| `ultra` | Security-sensitive tasks, complex bugs, architecture reviews, critical verification |

Do not invent Ponytail commands, levels or configuration options. Inspect existing configuration before assuming.

## F. Development workflow

1. Understand the task.
2. Inspect only the files it touches.
3. Check for an existing implementation.
4. Identify the minimum change.
5. Implement.
6. Run the relevant tests ([TESTING.md](TESTING.md)).
7. Review the diff.
8. Report results — never claim a test passed without running it.

## G. Scope control

Never implement future features prematurely. Version 2 AI work is out of scope until Phase 10.

## H. Project governance

Follow [PROJECT.md](PROJECT.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), [TASKS.md](TASKS.md), [TESTING.md](TESTING.md), [DECISIONS.md](DECISIONS.md) and [SECURITY.md](SECURITY.md).

When a task is completed, update [TASKS.md](TASKS.md) with its actual status.
