# DESIGN_SYSTEM.md — UI/UX Consistency

Authoritative source for **how the interface looks and behaves**. Requirements: [PROJECT.md](PROJECT.md). Structure: [ARCHITECTURE.md](ARCHITECTURE.md).

> **Status: Implemented (November 2026) — Apple-inspired minimal direction.** The frontend is built and verified against this document. Premium look comes from typography, spacing, alignment and consistency — not from animation or visual effects. When changing the UI, update this file in the same change.

## A. Design philosophy

A polished developer/productivity tool with Apple-like visual quality: simple, clear, quiet, fast, legible. The transcript is the product; chrome recedes. Every component must have a purpose — no decoration for its own sake.

## B. Visual principles

- Minimal interface, clear hierarchy, consistent spacing, high readability.
- Premium typography and generous whitespace do the heavy lifting.
- Subtle 1px borders; shadows only on floating surfaces (menus, toasts, hero preview).
- Restrained color: Apple-inspired neutrals, one blue accent, semantic colors only for state.
- No gradients or colorful backgrounds; no unnecessary animation; no decorative clutter.
- Never add visual weight that makes the app slower or harder to use.

## C. Color tokens

CSS variables in `globals.css`, exposed to Tailwind as semantic tokens. Light and dark are both mandatory.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#ffffff` | `#000000` | Page background |
| `--surface` | `#f5f5f7` | `#1c1c1e` | Cards, panels, hover fills |
| `--muted` | `#f5f5f7` | `#1c1c1e` | Subtle fills, skeletons |
| `--foreground` | `#1d1d1f` | `#f5f5f7` | Primary text |
| `--muted-fg` | `#6e6e73` | `#98989d` | Secondary text |
| `--border` | `#e8e8ed` | `#38383a` | Dividers, inputs |
| `--primary` | `#0071e3` | `#0a84ff` | Primary actions, links |
| `--primary-fg` | `#ffffff` | `#ffffff` | Text on primary |
| `--secondary` | `#1d1d1f` | `#f5f5f7` | Solid contrast actions |
| `--accent` | `#0071e3` | `#0a84ff` | Search-match highlight |
| `--success` | `#1a7f37` | `#3fb950` | Success states |
| `--warning` | `#9a6700` | `#d29922` | Caution states |
| `--error` | `#d70015` | `#ff453a` | Errors, destructive |

Semantic values are chosen for ≥ 4.5:1 text contrast in their theme. Secondary text uses `#6e6e73` rather than Apple's caption gray `#86868b`: at 13–15px the latter is only 3.6:1 and fails WCAG AA (verified with a Lighthouse audit). Search-match highlight uses `--accent` at ~20% opacity so transcript text stays readable.

## D. Typography

- **Family:** Apple system stack — `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Inter, system-ui, sans-serif`. Monospace for timestamps/code: `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`. No web-font download.
- **Scale** (Tailwind `fontSize` tokens): `display` clamp(44→64px) · `display-sm` clamp(32→48px) · `title` clamp(24→32px) · `body` 16/1.6 · `body-sm` 15/1.6 · `caption` 13/1.5.
- Headings are large, bold and tightly tracked (`letter-spacing` −0.01 to −0.02em); use `clamp()` for responsive size, never a different size per breakpoint.
- **Timestamps:** monospace, tabular numerals, fixed width so columns align.
- Body text ≥ 4.5:1 contrast in both themes; transcript rows use `body-sm` for comfortable reading.

## E. Spacing system

4px base scale: `4, 8, 12, 16, 24, 32, 48, 64`. Use the scale only — no arbitrary values. Prefer more whitespace over borders when separating sections.

## F. Radius and shadows

- Inputs / selects: `12px` (`rounded-md`).
- Buttons: pill (`rounded-full`).
- Cards / panels: `18px` small, `24px` large (`rounded-lg` / `rounded-xl`, via the `.card` class).
- Badges / chips: pill. Dialogs (if ever needed): `20px`.
- Shadows: `shadow` (0 1px 2px) for the hero preview; `shadow-md` for toasts; `shadow-lg` for dropdown menus. Dark theme relies on borders, not shadows.

## G. Component standards

| Component | Standard |
|---|---|
| Buttons | Pill, heights 32/36/44, 150ms color transition, `active:scale-[0.98]` press. Primary = filled `--primary`; secondary = outline; ghost = text. One primary per view. |
| Inputs | Height 40–44, radius 12, 1px `--border`, focus ring `--primary` 2px offset. `text-base` on mobile (prevents iOS focus zoom), `text-sm` ≥640px. Visible label or `aria-label`. |
| Textareas | Same as inputs; monospace when editing transcript text. |
| Selects / dropdowns | Native `<select>`, keyboard navigable. Menus (export) are button-triggered `role="menu"` panels: close on outside click and Escape, `animate-fade-in`. |
| Dialogs / tabs | No feature needs them in Version 1 — do not add components speculatively. |
| Toasts | Bottom-right fixed, pill, `shadow-md`, ≥ 4s dwell, `role="status"` (or `role="alert"` for errors). |
| FAQ accordion | Native `<details class="faq">` — CSS only; plus icon rotates 45° when open. |
| Cards | `.card` class only (one source of truth). Genuinely grouped content: features, steps, FAQ, preview, panels. |
| Navigation | Sticky, `bg-background/80 backdrop-blur-xl`, active link = `bg-surface` pill. Below 640px links move into a native `<details>` disclosure menu; theme toggle always visible. |
| Transcript segments | Card container, rows = timestamp (mono, clickable) + text, hover tint, copy/edit actions fade in on hover and on `focus-within`. |
| Search interface | Single field + monospace match counter + prev/next. Current match fully highlighted. |
| Export controls | Pill "Export" button opening a dropdown (TXT · SRT · VTT · MD · PDF · Copy · Select all). Disabled until a transcript exists. |
| Video preview | `.card`: thumbnail (radius 12) + title + channel + duration. Degrades gracefully when metadata is unavailable. |
| Toast feedback | Export/copy results confirm in the bottom-right toast instead of inline text. |

## H. Homepage design

Server component, ten compact sections with generous whitespace:

1. Sticky navbar · 2. Centered hero (chip, `display-sm` heading, subtext) · 3. URL form + primary button · 4. Static product preview card (mock transcript rows, `aria-hidden`) · 5. Features (6 cards) · 6. How it works (3 numbered steps) · 7. Export formats (chips) · 8. FAQ (native accordion) · 9. Closing CTA (card + second URL form, unique field id) · 10. Minimal footer.

No carousel, no testimonials, no pricing table, no long marketing copy.

## I. Transcript workspace design

Toolbar card (title · caption-type badge · search · language select · A−/A+ text size · fullscreen) with a second **tools row** (Undo/Redo · Remove fillers · Clean up text · Reading mode · ★ prev/count/next bookmark) → workspace → footer row (segment/word/character counts + reading time + language + annotation counts · export dropdown). On desktop (≥1024px) the workspace is two panes: sticky video player with its metadata card on the left (25–75% width, adjusted by dragging the divider or arrow keys on it) and the transcript pane on the right; below 1024px it stacks with no divider. The active segment — search match or playback position — gets a subtle primary tint and primary timestamp, and auto-scrolls only when off-screen (reduced-motion aware). Keyboard shortcuts: `/` search, `k` play/pause, `j`/`l` ±10s, `f` fullscreen, `r` reading mode, `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Shift+Z` (or `Y`) redo — ignored while typing. If the player fails to load, the metadata card replaces it and timestamps fall back to opening YouTube.

Row annotations (T3): a highlighted segment gets an accent tint, a bookmark shows a primary ★ next to its timestamp, and a note renders as a caption-size line beneath the segment text (inline editor on click). The five row actions (copy, edit, highlight, note, bookmark) reveal on hover/focus on desktop; below `sm` the action row wraps onto its own line under the text so touch targets stay ≥44px. The search card expands with a **Replace** toggle (replacement input + "Replace all (n)"). Reading mode hides the video pane and centres the transcript in a `max-w-3xl` column. Bulk tools confirm through a bottom-right `role="status"` toast with the changed-segment count.

AI panel (T4): the tools row gains a "✨ AI" button that opens a centred modal (`role="dialog"`, Escape / backdrop closes, focus on open). Inside: a key section (password input, "Use key", opt-in "Remember on this browser" checkbox, "Forget key", and the SECURITY §H disclosure paragraph), a truncation chip when the transcript exceeds the context budget, feature pills (Summary · Key points · Smart notes · Chapters · Topics · Learning notes · Speaker labels) disabled until a key is active, an `aria-live` area for "Generating…" and distinct error messages in `text-error`, a plain-text output card with Copy, and an "Ask this video" chat input (Enter to send). AI output is never rendered as HTML. Applying speaker labels runs through the undo history, confirmed by the standard status toast.

Export menu (format pills ×7 + copy with/without timestamps + select all) opens an **export options dialog** (`.card` panel over a `bg-black/40` scrim, z-40): format pills row → filename input with extension suffix → checkboxes (timestamps, metadata header) → scope radio group (entire transcript / search results *n*) → formatting radio group (segments / paragraphs) → Cancel + Export. Options shown depend on the selected format. Escape or mousedown-outside closes and returns focus to the menu trigger. Loading skeleton, empty state and error card are full `.card` surfaces with a Try again action.

## J. Responsive design

| Breakpoint | Behavior |
|---|---|
| Mobile < 640px | Single column, stacked toolbar, full-width input and CTA, nav links inside disclosure menu, export menu still reachable, 16px inputs |
| Tablet 640–1024px | Stacked toolbar (full-width search above language select), 2-column feature grid |
| Desktop > 1024px | Max-width 1100px content, 3-column feature grid, two-pane workspace (video \| transcript) with draggable divider |

No horizontal overflow at any width; touch targets ≥ 44px on mobile.

## K. Accessibility

- Full keyboard navigation; logical tab order; visible focus rings everywhere.
- Contrast ≥ 4.5:1 body, ≥ 3:1 large text and UI boundaries.
- Semantic HTML (`main`, `nav`, `button`, `label`, `details/summary`); landmarks and headings in order.
- `aria-live` for loading and stats; `aria-expanded`/`aria-haspopup` on the export menu; labelled icon-only buttons.
- Reduced-motion media query disables all non-essential motion.

## L. Interaction states

| State | Requirement |
|---|---|
| Loading | Skeleton + progress text; controls disabled, never frozen |
| Empty | Explain what to do next ("This video has no caption text available.") |
| Error | Plain-language message, what failed, what to do next; input preserved |
| Success | Toast confirmation + transcript rendered |
| Hover | Subtle tint only; no layout shift |
| Active | 150ms press scale on buttons |
| Disabled | 50% opacity, `not-allowed`, `aria-disabled` |

## M. Animation policy

CSS only, 150–200ms, restrained. Allowed: hover tints, button press, focus transitions, accordion icon rotation, dropdown fade-in, smooth anchor scrolling.

Forbidden — no dependency, no code: Three.js, React Three Fiber, GSAP, Framer Motion, Motion, Lenis, parallax, scroll-triggered animation, 3D/WebGL, animated backgrounds, heavy animation libraries. Respect `prefers-reduced-motion: reduce` by disabling non-essential motion.
