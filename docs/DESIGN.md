# SCOOP design

Documented from the final source (`web/src/styles.css`, `web/src/components/*`). Direction from
the brief: printed newspaper, off-white paper, black ink, one red accent, serif headlines, mono for
numbers, no gradients, mobile first. (This file lives under `docs/` because the assignment's write
scope is `web/**`, `dist/**`, `docs/**`.)

## Tokens (`:root` in styles.css)

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#f6f1e7` | page background |
| `--paper-2` | `#ece6d8` | sponsored box, disabled days, notices |
| `--ink` | `#141211` | text, rules, primary buttons |
| `--ink-2` / `--ink-3` | `#4a4541` / `#6d6762` | secondary text, hints |
| `--rule` / `--rule-soft` | `#141211` / `#c9c1b2` | section rules, table rows |
| `--red` | `#b3261e` | the one accent: kickers, active nav, selected day, accent buttons, errors, focus ring |
| `--ok` | `#1f5c2e` | success notice border only |
| spacing `--s-1`…`--s-12` | 0.25–3 rem | 4 px grid |
| `--measure` | `68ch` | prose width |
| `--focus` | `3px solid var(--red)` | `:focus-visible` everywhere, 2 px offset |

Colour pairs are solid (no alpha, no gradients): ink on paper, paper on ink, white on red. Nothing
is communicated by colour alone: selected days also carry `aria-pressed` and bold weight, booked
days are disabled, dashed and struck through, errors have text, state labels are words.

## Typography

- Serif (`Georgia, "Times New Roman", "Noto Serif"`): body 17 px / 1.5, headlines. Masthead
  `clamp(3rem, 12vw, 6.5rem)` weight 900; issue headline `clamp(2rem, 6vw, 3.5rem)`; section
  `h2` 1.75 rem; `h3` 1.25 rem; `text-wrap: balance` on headings.
- Sans (`system-ui` stack): UI chrome — nav, labels, hints, buttons, kickers (uppercase, tracked).
- Mono (`ui-monospace` stack): every number, address, hash, input and button text, with
  `font-variant-numeric: tabular-nums` on `.num`.
- No web fonts are loaded (IPFS, offline-safe). Text sizes are in rem; the layout reflows at 320 px.

## Components

- **Masthead**: date and network "ears", SCOOP title, tagline, double rule.
- **Nav**: four hash routes, `aria-current="page"`, 44 px targets, red underline for the active one.
- **Wallet bar**: live status (`aria-live="polite"`), Connect per injected connector, "Switch to
  Ethereum" accent button when on the wrong chain, Disconnect.
- **Sponsored box** (`.sponsored`): bordered, labelled "Sponsored", contract text as plain text.
- **Issue** (`.issue__*`, `.issue-section`, `.item`): dateline, headline, standfirst, five sections
  in a 1/3-column grid; each item is token (sans bold), figure (mono, right-aligned), one line.
- **Calendar** (`.calendar`, `.day`): 30 buttons, 5 per row on phones, 10 from 40 rem; selected
  state red, disabled state dashed/struck; each has a full-date accessible name.
- **Forms** (`.field`): visible labels, hints wired with `aria-describedby`, errors shown after the
  first submit with `aria-invalid`; inputs 44 px tall.
- **Buttons** (`.btn`, `--primary`, `--accent`, `--small`): 2 px ink border, 44 px minimum height
  (36 px for in-table `--small`), disabled at 45 % opacity with `cursor: not-allowed`.
- **Steps** (`.steps`): ordered list of wallet steps with state word, detail and explorer tx link,
  in an `aria-live` region; errors as `role="alert"` notices.
- **Tables** (`.table-wrap`): horizontal scroll container, uppercase sans headers, dotted rows.
- **Cards / notices / badges**: single-border surfaces; notices carry a 4 px left bar (ink, red
  for errors, green for success).
- **Footer**: every configured contract with a Copy button (announced via a visually hidden live
  region) and an explorer link; chain, source commit, launch id, link to `imd-deployment.json`.

## Responsive behaviour

Mobile first, single column. Breakpoints: 40 rem (calendar 10/row), 48 rem (two-column grids,
three-column issue sections, larger page padding), 64 rem (`.columns--main` 2fr/1fr for text + card).
Long addresses and headlines use `overflow-wrap: anywhere`; tables scroll inside their wrapper.
`prefers-reduced-motion` gates the only motion (smooth scrolling); there are no animations.
A skip link is the first focusable element; `main` receives focus on route change.
