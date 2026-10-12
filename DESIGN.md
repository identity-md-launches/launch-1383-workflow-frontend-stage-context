# SCOOP design

## Overview

A daily newspaper for the IMD swarm, with a sponsored front page and a SCOOP/IMD swap page.
The existing newspaper identity is retained: warm paper, dark ink, red emphasis, serif editorial
text and ruled columns. Source of truth: `web/src/styles.css` and `web/src/components/`.
The 1200×630 share card reuses the masthead and palette, without remote images or fonts.

## Colors

All values are the implemented CSS tokens, in hex.

| Token | Value | Role |
| --- | --- | --- |
| `--paper` | `#f6f1e7` | Page and neutral buttons |
| `--paper-2` | `#ece6d8` | Sponsor panel, notices, unavailable days |
| `--surface` | `#fffdf8` | Cards and inputs |
| `--ink` / `--rule` | `#141211` | Main text, dark buttons, structural rules |
| `--ink-2` | `#4a4541` | Secondary text |
| `--ink-3` | `#6d6762` | Hints and calendar secondary labels |
| `--rule-soft` | `#c9c1b2` | Quiet separators |
| `--red` | `#b3261e` | Active navigation, selected day, action, error and focus |
| `--red-ink` | `#ffffff` | Text on red |
| `--ok` | `#1f5c2e` | Success notice border |

Rendered pairs measured in Chromium: ink/paper 16.59:1, ink/surface 18.37:1, hint/surface
5.48:1, red/paper 5.81:1, white/red 6.54:1. These are the tested solid pairs, not a blanket
contrast certification. States also use words, underlines, borders or `aria-pressed`.

## Typography

The three system-font stacks require no runtime font downloads:

- `--font-serif`: Georgia, Times New Roman, Noto Serif, serif. Editorial text and headings.
- `--font-sans`: system-ui, Apple/Segoe UI/Roboto/Helvetica Neue/Arial fallbacks. Controls and notes.
- `--font-mono`: ui-monospace, SFMono-Regular, Menlo, Consolas, DejaVu Sans Mono, monospace.
  Inputs, addresses and figures; `.num` adds tabular numerals.

Six size tokens: `--text-small` .875rem (UI/notes), `--text-body` 1.0625rem (body/inputs/standfirst),
`--text-lead` 1.25rem (item headings/sponsor headline), `--text-title` 1.75rem (section headings),
`--text-headline` clamp(2rem, 6vw, 3.5rem), and `--text-masthead` clamp(3rem, 12vw, 6.5rem).
Body line height is 1.5; headings 1.15; masthead 1. Headings balance their lines, and long prose
is capped at `--measure: 68ch`. CSS requests weights 400/600/700/800/900 and italic where shown;
actual font faces depend on the OS fallback. No claim is made that every requested weight has
a distinct installed face. Masthead tracking is .04em, desktop navigation .08em. Redundant
section kickers were removed; the sponsor label remains a necessary content disclosure.

## Layout

`.page` is at most 72rem, centered, with 1rem padding; at 48rem it uses 1.5rem vertical and
2rem horizontal padding. Spacing tokens `--s-1/2/3/4/6/8/12` map to .25/.5/.75/1/1.5/2/3rem.
`.columns` is one column by default, two at 48rem; `.columns--3` becomes three at 48rem and
`.columns--main` becomes 2fr/1fr at 64rem. Calendar: five columns, ten from 40rem.

Below 48rem navigation uses two rows of two links, natural case and no tracking. The trade card
comes first in DOM and phone reading order. Its action precedes transaction guidance. From 48rem,
pool details occupy column 1 and the trade card column 2. The intro reads “Swap IMD and SCOOP.
Pool fee: 1.25%.” with the fee derived from the unchanged pool key. Booking rules use a native
`details` disclosure so choosing a date is close to the heading; prices stay visible.

At 390×844, the initial Swap button ends at y=798.69 and the first available calendar day at
y=807.69. Every route was checked at 320, 390, 768 and 1440 pixels without horizontal document
overflow. Long addresses wrap; tables can scroll inside `.table-wrap`. The archive number
header stays on one line. Text enlargement to 200% was checked on Trade; this is not native zoom.

## Elevation & depth

Flat surfaces, no gradients or elevation shadows. Ink borders and the masthead double rule express
newspaper structure. Paper-2 distinguishes sponsorship and notices. The selected calendar day
has a 2px inset paper line. The only special stacking is the focused skip link (`z-index: 10`).

## Shapes

Buttons and inputs have 2px corner radii. Cards and calendar cells are square. Buttons have 2px
borders; cards/inputs/cells 1px; notices a 4px leading bar. All primary buttons/inputs have 44px
minimum height, table buttons 36px, calendar cells 56px. Nothing is communicated by shape alone.

## Components

| Pattern / source | Behavior and reuse |
| --- | --- |
| `App.tsx`, masthead and `.nav` | Existing hash routes; active underline and `aria-current`. The first link prevents default hash navigation and focuses/scrolls `#main`, preserving form values. |
| `WalletBar.tsx`, `useWallet` in `hooks.ts` | Probe providers before offering connectors; deduplicate the same provider; every button says Connect wallet. Named wallets get an adjacent identity. Missing providers receive actionable text. Badge uses `useAccount().chainId`; transaction readiness additionally requires a matching client/account. |
| `Issue.tsx` | Dateline, serif headline, standfirst, token/figure/text items, source links and method note. Static issue text remains plain text. |
| `Sponsored.tsx` | Explicit sponsor disclosure; contract headline/link are never injected HTML. |
| `Book.tsx` | Days remain disabled until booked-day and required slot reads succeed. Loading, failure with Retry bookings, and successful empty results are distinct in calendar, own list and ledger. Native details exposes booking/refund rules. |
| `Trade.tsx` | Buy/Sell pressed states, decimal amount, quote, minimum and Swap. Slippage must be finite and 0–50 inclusive, with linked inline error and a second check in the handler. |
| `.field`, `.btn`, `.notice` | Visible labels; 44px inputs; error descriptions and `aria-invalid`. Primary ink, accent red, neutral outlined buttons. Disabled buttons use .45 opacity and a disabled cursor. |
| `Steps.tsx` | Ordered wallet operations with text states, explorer links and persistent error feedback. |
| `Footer.tsx` | Copyable configured addresses, explorer links and runtime deployment metadata. |

Focus is `3px solid var(--red)` with 2px offset on `:focus-visible`. The red outline seen around
the routed main content is focus, not decoration. Smooth scrolling is enabled only when reduced
motion is not requested; there are no other animations, overlays, theme controls or icon systems.

## Do's and don'ts

Reuse `.section`, `.columns`, `.field`, `.btn`, `.notice` and the shared wallet/transaction hooks.
Put a new hash route in `App.tsx` and test the static export under a subpath. Preserve serif
editorial hierarchy, sans controls, mono figures and the six size tokens. Keep read failures
distinct from zero and empty values; gate writes using the connector's actual chain and current
wallet client. Retain visible reasons for unavailable actions. Use the verified runtime manifest
for contract configuration. Do not add a second palette, remote fonts or invented reporting values.

## Review and attribution

Actual checks and remaining limits: [docs/validation.md](docs/validation.md). Browser screenshots
use simulated chain data. Screen readers, native browser zoom, physical phones and real wallet
transactions were not tested.

Design review applied the pinned Better Interface guidance by Jakub Krehel (MIT,
`267330e1adfc66a718fb65fa6918c1f06d0a689e`). This documentation follows the adapted Impeccable
method by Paul Bakaus (Apache-2.0, `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`,
[source](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md)).
Both notices/licenses are retained in [docs/licenses/better-interface-LICENSE.txt](docs/licenses/better-interface-LICENSE.txt).
