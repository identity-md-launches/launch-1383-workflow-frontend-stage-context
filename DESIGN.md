# SCOOP design

## Overview

SCOOP is a daily newspaper about the IMD swarm. The front page pairs a large nameplate with a lead story, a ruled numbers rail, a turnover graphic and three news columns. Book and Trade use the same paper, ink and typography with native controls. The source of truth is `web/src/styles.css`, `web/src/App.tsx` and `web/src/components/`.

The newspaper is deliberately flat and typographic. Rules organize editorial columns; they are not card shadows. Red marks the current section, primary actions, errors and the leading chart bar. Labels and geometry carry meaning alongside color.

## Colors

All tokens are in `web/src/styles.css`; retain the existing hex notation.

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#f6f1e7` | Page and neutral controls |
| `--paper-2` | `#ece6d8` | Notices and unavailable calendar dates |
| `--surface` | `#fffdf8` | Form cards and inputs |
| `--ink`, `--rule` | `#141211` | Main text and structural rules |
| `--ink-2` | `#4a4541` | Secondary prose and explanatory labels |
| `--ink-3` | `#6d6762` | Hints and disabled outlines/text |
| `--rule-soft` | `#c9c1b2` | Quiet item and control separators |
| `--red` | `#b3261e` | Active nav, action, error, focus and chart emphasis |
| `--red-ink` | `#ffffff` | Text on a red action |
| `--ok` | `#1f5c2e` | Retained `.notice--ok` border variant |

Measured in Chromium on the actual opaque backgrounds: ink/paper **16.59:1**, ink/surface **18.37:1**, hint/surface **5.48:1**, red/paper **5.81:1**, white/red **6.54:1**. These are the tested pairs, not a blanket accessibility certification. There is one light theme.

## Typography

WOFF2 files and their licenses are bundled in `web/public/fonts/` and copied to `dist/fonts/`; CSS references resolve relative to the export. `web/index.html` preloads the nameplate and regular text face. All faces use `font-display: swap`.

- `--font-display`: **Playfair Display 900**, then Georgia/serif. Nameplate, headlines, section headings, ad headlines and drop cap.
- `--font-serif`: **Source Serif 4**, then Georgia/Times New Roman/Noto Serif/serif. Body text and folio. Files provide normal 400, 600 and 700, plus italic 400; the deck is a true italic face. Regular, semibold, bold and italic are used across editorial text and controls.
- `--font-mono`: **IBM Plex Mono 400/600**, then system monospace. Figures, addresses and inputs; 600 emphasizes the rail figures. `.num` uses tabular numerals.
- `--font-sans`: a retained token name that aliases `--font-serif` for navigation, controls and small operational notes. It does not introduce a fourth typeface.

The six size tokens are `--text-small: .875rem`, `--text-body: 1.0625rem`, `--text-lead: 1.25rem`, `--text-title: 1.75rem`, `--text-headline: clamp(2rem, 4.2vw, 3.5rem)` and `--text-masthead: clamp(64px, 22vw, 168px)`. Body line height is 1.5; the deck uses 1.45; issue headlines 1.12; the nameplate 1.05. Large type has slightly negative tracking (`-.025em` headline, `-.04em` nameplate). Editorial prose uses `--measure: 68ch`.

Use balanced headings, plain text paragraphs, selectable figures and complete addresses that wrap. Display numbers use grouping, never exponent notation. Tiny token amounts retain their first four significant fractional digits, up to the token’s 18-decimal precision; a nonzero amount is never formatted as zero. The drop cap is the first letter of the first story paragraph.

## Layout

`.page` is centered at a maximum of **80rem**, with 1rem padding, changing to 1.5rem vertical/2rem horizontal at 48rem. Spacing tokens `--s-1/2/3/4/6/8/12` are .25/.5/.75/1/1.5/2/3rem.

The masthead shows SCOOP, the existing short description and the folio “Vol. I · No. {n} · {weekday, date} · Ethereum edition”. The folio follows the selected issue; there is no duplicate issue dateline. Navigation is one row: Front · Archive · Advertise · Trade. Separating dots are hidden from assistive technology. Under large text enlargement the nav can scroll locally while keeping one row.

At **1024px (64rem)**, `.newspaper` has 12 equal columns and **32px gutters**. The lead spans columns 1–8; the numbers rail spans 9–12 beside the lead and graphic. A 1px ink rule divides those occupied columns. The chart sits immediately below the lead in columns 1–8; the rail’s hairline box fills its height. The ad follows across the page, then the three equal news columns with 1px gutter rules. The reporting note closes the article. This is a front-page composition, not a universal grid for every form.

Below 1024px the DOM reading order is lead → Swarm numbers → graphic → ad → news → reporting. At 390×844 the front-page headline begins at roughly **316px**, within the requested 420px. The Book calendar and Trade swap control are also visible on the first phone screen. Book’s wallet card follows the calendar; Trade’s wallet area follows the quote and action, inside the trade card. Reader pages contain no wallet bar.

General `.columns` becomes two columns at 48rem. Trade’s details occupy the left column and its form the right; on phones the form comes first. Calendar dates use five columns, then ten at 48rem. `.table-wrap` provides local horizontal scrolling for dense ledgers; addresses and prose wrap. All five routes were checked at 320, 390, 500, 1024 and 1440 CSS pixels without document overflow. Trade also passed 200% text enlargement; browser-native zoom and physical devices were not tested.

## Elevation & depth

No gradients or elevation shadows. The masthead uses a 3px top rule and 4px double bottom rule. The ad frame and section dividers use 3px double rules; column dividers and cards are 1px. The selected calendar date has a 2px inset paper line. The focused skip link sits above content at `z-index: 10`.

## Shapes

Editorial boxes and calendar cells are square. Buttons and fields retain 2px corner radii. Buttons have 2px ink borders; inputs and cards use 1px. Buttons/inputs have a 44px minimum height, small ledger buttons 36px, calendar dates 56px. Disabled buttons are transparent, grey ink outlines with full opacity; selected or primary red never fades into a disabled state.

## Components

| Pattern / source | Reuse and behavior |
| --- | --- |
| `App.tsx` | Shared masthead, issue folio, single-row hash navigation and skip link. Route changes focus `#main`; `#main:focus { outline:none }` suppresses the unwanted page box. |
| `Issue.tsx`, `lib/issues.ts` | Validated issue loading; optional deck/body with legacy fallback; lead, rail, proportional turnover chart, news columns and small reporting note. Issue text is never injected HTML. |
| `Sponsored.tsx` | Shared `AdCreative` for booked ads and `AdPreview`. Displays token symbol, display headline and HTTPS domain only. Double-rule `sponsored` frame and small-caps disclosure distinguish advertisements. Empty slot gets a priced house ad and Book link. |
| `Book.tsx`, `market.ts` | Contract-derived calendar, known/loading/failed availability, SCOOP and approximate IMD price, editable creative preview. Native rules disclosure. Existing approve/book, burn and owner controls remain. |
| `Trade.tsx`, `lib/format.ts`, `lib/pool.ts` | Buy/Sell pressed buttons, amount, slippage, quote/minimum and swap. Grouped figures and labelled virtual pool reserves; 20-second and pre-swap quoting. Signing locks editable trade terms. |
| `WalletBar.tsx`, `hooks.ts` | Available injected wallets only; connector identity and readiness kept distinct. Wrong-chain switch, missing-provider guidance and three wallet deep links. Embed only in Book/Trade cards. |
| `Feedback.tsx`, `Steps.tsx` | Persistent error with Retry, application error boundary and ordered transaction states. RPC/library text is sanitized; loading/error is distinct from empty. |
| `Footer.tsx` | Configured addresses once, copy and explorer controls; Contract source (387e2fe) and Site source links. |
| `.field`, `.btn`, `.card`, `.notice` | Retained labelled native fields, ink/red/neutral actions, flat form surfaces and status panels. Prefer these to per-page replacements. |

Interactive `:focus-visible` uses a 3px red outline with 2px offset; nav links use an inset offset so the scroll container does not clip it. Forced-colors uses system Highlight/GrayText. The main-landmark exception does not remove control rings. Errors use alert/status semantics; input errors link to their descriptions. No new motion is introduced; the existing smooth scrolling is enabled only when reduced motion is not requested.

## Do’s and don’ts

Start another page with the shared shell, `.section`, `.columns`, `.field` and `.btn`. Keep the current hash routes and deployment manifest as configuration. Use the six type tokens and local faces. Put contract errors beside a retry and never present failed reads as zero or empty.

For another issue, add valid JSON and its index entry, keep factual source/window context, use two or three short body paragraphs and let `IssueBody` build the page. Do not add reporting numbers to fill space, interpret turnover as price return, fetch remote fonts or expose wallet UI on reader pages. Keep virtual reserves explicitly distinguished from shared manager balances.

Review details and limits: [docs/validation.md](docs/validation.md). The design guide is adapted from Jakub Krehel’s Better Interface (MIT, `267330e1adfc66a718fb65fa6918c1f06d0a689e`). Documentation follows Paul Bakaus’s Impeccable method (Apache-2.0, `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`, [source](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md)). Both notices/licenses remain in [docs/licenses/better-interface-LICENSE.txt](docs/licenses/better-interface-LICENSE.txt).
