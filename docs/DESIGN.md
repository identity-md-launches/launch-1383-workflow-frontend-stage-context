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
- Mono (`ui-monospace` stack): numbers, addresses, hashes and input text (buttons override to sans), with
  `font-variant-numeric: tabular-nums` on `.num`.
- No web fonts are loaded (IPFS, offline-safe). Text sizes are in rem; the layout reflows at 320 px.

## Components

- **Masthead**: date and network "ears", SCOOP title, tagline, double rule.
- **Nav**: four hash routes, `aria-current="page"`, 44 px targets, red underline for the active one.
- **Wallet bar** (`WalletBar.tsx`, `useWallet` in `hooks.ts`): live status (`aria-live="polite"`),
  Connect wallet for an available generic provider or the discovered wallet’s name, actionable
  no-wallet copy when none is available, "Switch to Ethereum" when the actual connector chain
  differs, and Disconnect. Transaction gates also require a matching wallet client.
- **Sponsored box** (`.sponsored`): bordered, labelled "Sponsored", contract text as plain text.
- **Issue** (`.issue__*`, `.issue-section`, `.item`): dateline, headline, standfirst, five sections
  in a 1/3-column grid; each item is token (sans bold), figure (mono, right-aligned), one line.
- **Calendar** (`.calendar`, `.day`): 30 buttons, 5 per row on phones, 10 from 40 rem; selected
  state red; unavailable days are disabled and dashed, while known booked days also carry
  `.day--booked` with a strike-through. Each has a full-date accessible name. Availability remains
  unknown until `bookedDays` succeeds; ledger/own-booking rows additionally require every slot read.
  Loading, failure with Retry bookings, and successful empty results are separate states.
- **Forms** (`.field`): visible labels, hints wired with `aria-describedby`, errors shown after the
  first submit with `aria-invalid` for bookings; slippage validates immediately with a linked
  inline error and a disabled Swap action outside 0–50%. Inputs are at least 44 px tall.
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
On Trade, the card is first in DOM and mobile reading order, directly below the heading. From
48 rem, `.trade-details` occupies column 1 and `.trade-card` column 2, preserving the desktop
layout. The short pool-fee paragraph, state reads and copyable addresses follow the card on mobile.
Long addresses and headlines use `overflow-wrap: anywhere`; tables scroll inside their wrapper.
`prefers-reduced-motion` gates the only motion (smooth scrolling); there are no animations.
A skip link is the first focusable element. Its handler focuses and scrolls the existing `main`
without changing the hash route, preserving form state. `main` also receives focus on route
change, with the established red outline visible in the screenshots. The final export was
checked for overflow at 320, 390, 768 and 1440 px; screenshots at 390 and 1440 are retained in
`docs/evidence/`. Native zoom, physical devices and screen readers were not tested.


## Sharing

`web/public/share-card.png` (exported as `dist/share-card.png`) is a 1200×630 typography-only card:
paper background, black SCOOP masthead and newspaper rules, one red boxed label. The source
recipe is `web/scripts/share-card.mjs`; it uses the same serif/mono roles and hex palette without
external images or fonts. `web/index.html` supplies OG and Twitter metadata with relative image
paths for static gateway hosting. An absolute social URL awaits the publisher's final hostname.

## Reuse and restraint

Use `.section`, `.columns`, `.field`, `.btn`, `.notice` and `Steps` for additional contract controls;
keep transaction prerequisites visible and use the shared wallet state. Treat unknown RPC data
as unknown, not as a zero count. Maintain serif editorial headings, sans controls, mono figures,
plain-text sponsor content and flat ruled surfaces. Preserve the no-gradient, paper/ink/red design;
do not introduce a theme, animation or additional accent to solve an unrelated local change.
