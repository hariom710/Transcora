# DESIGN_SYSTEM.md — UI/UX Consistency

Authoritative source for **how the interface looks and behaves**. Requirements: [PROJECT.md](PROJECT.md). Structure: [ARCHITECTURE.md](ARCHITECTURE.md).

> **Status: Proposed.** No frontend code exists in this repository yet. Tokens and component states below are the target, not a claim about existing components. Verify against the actual frontend before marking anything implemented.

## A. Design philosophy

A polished developer/productivity tool — not a generic AI landing page. Quiet, fast, legible. The transcript is the product; chrome recedes.

## B. Visual principles

- Minimal interface, clear hierarchy, consistent spacing, high readability.
- Subtle 1px borders instead of heavy shadows.
- Restrained color: one primary, one accent, semantic colors only for state.
- No unnecessary animations, no excessive gradients, no decorative cards.
- Never add visual weight that makes the app slower or harder to use.

## C. Color tokens

CSS variables in `globals.css`, exposed to Tailwind as semantic tokens. Light and dark are both mandatory.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#ffffff` | `#0b1220` | Page background |
| `--foreground` | `#0f172a` | `#e6edf7` | Primary text |
| `--surface` | `#f8fafc` | `#111a2e` | Raised panels |
| `--muted` | `#f1f5f9` | `#1a2439` | Subtle fills |
| `--muted-fg` | `#64748b` | `#94a3b8` | Secondary text |
| `--border` | `#e2e8f0` | `#24304a` | Dividers, inputs |
| `--primary` | `#2563eb` | `#3b82f6` | Primary actions |
| `--primary-fg` | `#ffffff` | `#ffffff` | Text on primary |
| `--secondary` | `#0f172a` | `#e6edf7` | Secondary actions |
| `--accent` | `#7c3aed` | `#a78bfa` | Highlights, search match |
| `--success` | `#16a34a` | `#22c55e` | Success states |
| `--warning` | `#d97706` | `#f59e0b` | Caution states |
| `--error` | `#dc2626` | `#ef4444` | Errors, destructive |

Search-match highlight uses `--accent` at reduced opacity so transcript text stays readable.

## D. Typography

- **Family:** system stack — `Inter, ui-sans-serif, system-ui, sans-serif`; monospace for code/timestamps: `ui-monospace, SFMono-Regular, Menlo, monospace`.
- **Hierarchy:** h1 30/36 · h2 24/32 · h3 20/28 · body 15/24 · label 13/20 · caption 12/16.
- **Timestamps:** monospace, tabular numerals, fixed width so columns align.
- Body text ≥ 4.5:1 contrast in both themes.

## E. Spacing system

4px base scale: `4, 8, 12, 16, 24, 32, 48, 64`. Use the scale only — no arbitrary values.

## F. Radius and shadows

- Radius: `sm 4px` (inputs, badges) · `md 8px` (buttons, cards) · `lg 12px` (dialogs).
- Shadow: one level only — `0 1px 2px rgb(0 0 0 / 0.05)`. Dialogs may use `0 8px 24px rgb(0 0 0 / 0.12)`. Dark theme relies on borders, not shadows.

## G. Component standards

| Component | Standard |
|---|---|
| Buttons | Heights 32/36/40. Primary = filled `--primary`; secondary = outline; ghost = text. One primary per view. |
| Inputs | Height 40, 1px `--border`, focus ring `--primary` at 2px offset, visible label or `aria-label`. |
| Textareas | Same as inputs; monospace when editing transcript text. |
| Selects / dropdowns | Native-styled, keyboard navigable, 36px options. |
| Dialogs | Focus-trapped, Esc closes, labelled by title, backdrop dimmed. |
| Tooltips | Keyboard-reachable, 500ms delay, never the only source of information. |
| Toasts | Bottom-right, ≥ 4s dwell, `role="status"`, one at a time for errors. |
| Tabs | Underline indicator, arrow-key navigation, `role="tablist"`. |
| Cards | Only for genuinely grouped content. Max radius `md`, 1px border, no shadow. |
| Navigation | Header: logo, Transcript, Features, About. Theme toggle right-aligned. |
| Transcript segments | Row = timestamp (mono, clickable) + text. Hover tints `--muted`; active segment tints `--accent` at 10%. |
| Search interface | Single field + match count + prev/next. Current match fully highlighted. |
| Export controls | Compact button group: TXT · SRT · VTT · MD · PDF · Copy. Disabled until a transcript exists. |
| Video preview | Thumbnail (16:9, radius `md`) + title + channel + duration. Degrades gracefully when metadata is unavailable. |

## H. Homepage design

Header · centered hero ("Convert YouTube videos into searchable transcripts. Simple, fast and free.") · URL input + primary "Generate Transcript" button · caption "No account required · Free exports" · three-step "How it works" (Paste URL → Get transcript → Export) · minimal footer. No carousel, no testimonials, no pricing table.

## I. Transcript workspace design

Video preview header → status ("Transcript ready") → toolbar (search field, language selector, generated/manual badge) → timestamped segment list → footer (segment/word/character counts, language) → export button group.

## J. Responsive design

| Breakpoint | Behavior |
|---|---|
| Mobile < 640px | Single column, stacked toolbar, full-width input, horizontally scrollable export group |
| Tablet 640–1024px | Two-column workspace where space allows |
| Desktop > 1024px | Max-width 1100px content, sticky toolbar, side-by-side preview and controls |

Touch targets ≥ 44px on mobile.

## K. Accessibility

- Full keyboard navigation; logical tab order; visible focus rings everywhere.
- Contrast ≥ 4.5:1 body, ≥ 3:1 large text and UI boundaries.
- Semantic HTML (`main`, `nav`, `button`, `label`); landmarks and headings in order.
- `aria-live` for loading, success and error announcements.
- Screen-reader labels for icon-only buttons; timestamps announced with their segment.

## L. Interaction states

| State | Requirement |
|---|---|
| Loading | Skeleton or spinner + progress text; controls disabled, never frozen |
| Empty | Explain what to do next ("Paste a YouTube URL to begin") |
| Error | Plain-language message, what failed, what to do next; input preserved |
| Success | Confirmation toast + transcript rendered |
| Hover | Subtle tint only; no layout shift |
| Disabled | 50% opacity, `not-allowed`, `aria-disabled` |

## M. Animation policy

CSS transitions only, 150ms ease-out, transform/opacity only. No parallax, no scroll-jacking, no looping decoration. Respect `prefers-reduced-motion: reduce` by disabling non-essential motion.
