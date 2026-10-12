# SCOOP implementation validation

Complete for the stated website scope. This is the worker’s record, not independent certification. The production export is prepared for the publisher to update the existing **scoop.site.identitymd.eth** name; this task did not deploy contracts or issue a separate publishing command.

## Scope and consequential choices

Updated the existing web app, local assets, static export and documentation. Contracts, ABI files, deployed addresses, hash routes, original issue #1 fields, package manifests, lockfiles, protected build configuration and ignore rules are unchanged. The only issue data additions are `deck` and three `body` paragraphs drawn from the existing edition.

The desktop lead and chart share eight columns; the numbers rail occupies four alongside both. On phones the DOM order remains lead, numbers, chart, ad, then news. The ad’s “next free day” is the earliest available date in the contract’s booking window. Pool reserves are explicitly labelled virtual balances of active liquidity; the v4 manager’s shared balances are not represented as this pool’s reserves. No missing reporting metric was invented.

## Commands and actual outcomes

Commands below ran against the final source/export from the repository root unless noted. Node **24.9.0** and Chromium **154.0.8037.0** were used.

| Command / check | Result |
| --- | --- |
| `npm ci --prefix web --cache /tmp/scoop-npm-cache --no-audit --no-fund` | Passed. Existing dependency peer/deprecation warnings; package files unchanged. |
| `npm run typecheck --prefix web` | Passed. The final production build also runs TypeScript with `--noEmit`. |
| `npm test --prefix web` | Passed: **8 files, 55 tests**. Includes 21 issue/index/date/legacy tests and 9 numeric/error/reserve tests, plus retained chain, swap, config, day, field and wallet cases. |
| `npm run build --prefix web` | Passed after the last runtime/style edit. Existing third-party annotation warnings and a >500 kB JavaScript chunk warning remain. |
| `npm run manifest --prefix web` | Passed; **19 assets** inventoried, including local font files and licenses. |
| `npm run check:export --prefix web` | Passed: canonical hashes of both ABIs and their pinned source commit, exact deployment/network/pool key, complete asset hashes, relative export URLs, absolute social tags, PNG dimensions and issue source/export equality. Exported asset content is approximately 900 kB. |
| `node web/scripts/check-report.mjs` | Passed preserved issue arithmetic: 564 pools, 524 quiet, 6,468 swaps, 17 deployments, 327 jobs, the exact 24-hour interval and source evidence. |
| `SCOOP_CHROMIUM=/opt/ms-playwright/chromium-1246/chrome-linux64/chrome npm run test:browser --prefix web` | Passed with **75 recorded observations** against the production export under `/preview/index.html`. RPC/wallet fixtures only, no broadcast. Machine results: `docs/evidence/browser-results.json`. |
| Read-only public Ethereum requests | Passed via Publicnode (dRPC configured as fallback). Node results in `frontend-live-reads.json`; real-browser results in `frontend-live-browser.json`. |
| `git diff --check` and path/issue comparison | Passed; no forbidden configuration/dependency/contract/ABI/ignore modifications and no changed original issue fields. |

The browser connector itself could not launch: it expected Chrome at `/home/seat/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome`. A redundant install attempt was cancelled after locating the installed browser under `/opt/ms-playwright/`. Direct Playwright successfully performed the rendered checks and screenshots. The test harness starts and closes its own bounded preview/browser; no preview server is part of the export.

## Browser and interaction evidence

All five routes—front, archive, issue #1, Book and Trade—were exercised at **390×844, 500×844 and 1440×900**, plus **320×844 and 1024×900**. Every route had a single navigation row, no document overflow, and no main-landmark outline. Wallet bars appeared exactly once on Book/Trade, inside their cards, and never on the three reader pages. The desktop newspaper computed 12 columns and 32px gutters; screenshots show the ink rules and 8/4 allocation.

At 390px the front-page headline starts at **315.58px**; the archived issue headline at **369.08px**. The first available Book date ends around **655px** and the Trade swap button around **700px**, both on the first screen. The midnight at-press state also keeps the headline above 420px. At mobile widths the measured lead, numbers and graphic positions preserve their requested order.

The suite covers:

- Front → Archive → issue navigation, all route reloads under a static subpath, skip-link focus without losing typed form values, actual loaded local font faces and visible input focus.
- House ad price/next date, booked symbol and domain-only link/disclosure, live preview updates and rejection of unsafe preview links; contract calendar data overriding the clock.
- No wallet, the three exact wallet deep-link URLs at all required widths, provider discovery/deduplication, rejection recovery, wrong-chain switch, unknown-chain add/switch and delayed-client identity.
- Book loading, failed booked-day reads, loading/failed slot reads, retries, successful empty state, locked unavailable days, invalid form focus and valid approval rejection without broadcasting.
- Grouped `354,200 SCOOP per IMD`, no raw liquidity/USD row or duplicate token addresses, a 1-SCOOP quote of `0.000002606 IMD` and minimum `0.000002579 IMD` in fixtures. Tiny quote and minimum checks run at all three required widths. Controlled browser time checks the 20-second refresh; pre-swap re-quote and router simulation are observed after already-satisfied approvals. Invalid slippage is blocked even when a test bypasses the DOM disabled attribute.
- UTC-midnight at-press copy, future-issue filtering, legacy issues without deck/body, invalid index and issue recovery, startup retry, sanitized RPC errors, and a forced render failure caught by the error boundary followed by successful Retry.
- Computed contrast on five rendered pairs and Trade at 200% text enlargement with no document overflow. This is text enlargement, not native browser zoom.

`docs/evidence/{front,archive,issue,book,trade}-{390,500,1440}.png` are the final screenshots. Mobile/intermediate images show the first viewport; desktop images show the full page. `trade-quote-{390,500,1440}.png` records tiny quotes, and `keyboard-trade-390.png` shows the visible input ring. All screenshots use deterministic chain fixtures; issue text is the preserved edition. The figures in those trading screenshots are not presented as current live market data.

Screenshots were visually inspected across the requested routes and widths. The review caught and fixed an overlong first screen on Book, decorative dots leaking into accessible nav names, and excess space between the lead and chart. Final browser results have **no unexpected console errors or local resource failures**. One intentional render exception is recorded separately as the error-boundary test’s expected console event.

## Live read verification

At **2026-10-12T11:17:23.269Z**, public Ethereum reads returned price **2,000,000 SCOOP**, `currentDay = 20738` (decoded back to **2026-10-12 UTC**), booking days **20739–20768** (13 October–11 November), a nonzero pool price/liquidity and a simulated one-SCOOP sell output of **0.000002766231663473 IMD**. These are read-only observations, not issue #1’s historical close.

At **2026-10-12T11:29:05.154Z**, the actual production UI in Chromium used public RPC responses to show the next free day **2026-10-13**, approximate slot cost **5.602495 IMD**, a one-SCOOP output **0.000002766 IMD** and minimum **0.000002738 IMD**. Recorded public requests returned HTTP 200; no browser errors or horizontal overflow were observed. See the two separate live evidence files for exact values and context.

## Better Interface: consolidated six-domain review

Applied the pinned guide’s workflow and all six core domains while implementing, then reviewed the finished export. The requested print design governs the structural rules and advertisement label. Source locations below identify the final implementation of each correction.

| Domain | Coverage | Findings, correction and recheck |
| --- | --- | --- |
| Accessibility | **Checked**: native controls, headings/landmarks, labelled fields, keyboard/skip focus, status/error semantics, target sizes, reduced-motion and forced-color source rules | **MEDIUM**, `web/src/styles.css:61`, `App.tsx`: routed main acquired a page-sized ring and decorative nav dots changed link names. Main-only outline exception plus hidden decorative spans corrected both. Buttons/inputs retain visible rings; `keyboard-trade-390.png` inspected. Invalid Book submission focuses the first invalid control. |
| Layout | **Checked**: all routes at five widths, first-screen actions, order, gutters/rules, clipping and text enlargement | **MEDIUM**, `web/src/styles.css:140`, `components/Issue.tsx:49`: flat sections became a 12-column lead/rail/chart and three ruled news columns. **MEDIUM**, `components/Book.tsx:136`: added wallet choices pushed the first calendar action below 844px during review; moved the wallet card after the calendar and tightened mobile intro spacing. Rechecked first action around 655px. |
| Writing | **Checked**: source copy and rendered loading/empty/error states | **MEDIUM**, `components/FrontPage.tsx:18`, `components/Sponsored.tsx:30`: missing-day copy now says the issue is at the press; house ads give price/date/Book, paid ads disclose unchecked links, and methodology is a small bottom note. Archive uses `#` and no JSON developer note. Footer labels both source repositories. |
| Typography | **Checked**: real local face loading, six size tokens, hierarchy, wrap/measure, numeric formatting at all requested widths | **HIGH**, `lib/format.ts:4`, `components/Trade.tsx:43`: four fixed decimals hid small IMD outputs and exponent notation obscured large rates. Significant fractional precision and grouped display fix both quote/minimum and rate. **MEDIUM**, `styles.css:1`: self-hosted Playfair 900, Source Serif 4 and IBM Plex Mono replace the requested font roles, with a real italic deck and drop cap. |
| Colors | **Checked**: retained hex roles, actual rendered solid pairs and disabled/selected states | **MEDIUM**, `styles.css:75`: disabled red buttons previously faded; now full-opacity grey outlines. Measured ink/paper 16.59:1, ink/surface 18.37:1, hint/surface 5.48:1, red/paper 5.81:1 and white/red 6.54:1. No contrast failure in those measured pairs; states also have words, borders/underlines and pressed attributes. |
| UI | **Checked**: field/card/button loading, error, empty, focus and selected states; wallet and quote recovery | **HIGH**, `lib/issues.ts:22`, `components/Feedback.tsx:4`, `main.tsx:36`: unvalidated files/raw errors could break the app or expose library text. Added schema validation, retry notices and an app boundary; malformed-file/startup/render tests recover. **MEDIUM**, `market.ts:7`, `components/Trade.tsx:80`: calendar uses contract terms with clock fallback; quotes refresh every 20 seconds and immediately before simulation without weakening the accepted minimum. Mobile wallet links and the live preview were checked. |

No remaining required-scope blocker was observed. Dark themes, animation sequences, custom dialogs and drag interactions are **Not applicable**; this product does not implement them. Manual screen-reader sessions, native zoom, physical devices, automated axe scans, real wallet deep-link handoffs and signed transactions are **Not performed**. Wallet tests use EIP-1193 fixtures; live verification is read-only. Final publication and external social-card unfurling occur after submission acceptance and were not claimed as tested here.

The source-derived [DESIGN.md](../DESIGN.md) documents the final tokens, typography, layout and reusable components. Better Interface/Impeccable notices remain in `docs/licenses/better-interface-LICENSE.txt`; font licenses ship beside their WOFF2 files.

## Submission integrity

Source, the existing package manifest/lockfile, `dist/index.html`, all referenced assets and font licenses remain complete. No registry archives, caches, installed dependencies, submodules or scratch scripts are added. Scratch tools/logs stayed under `/tmp`; no ignore rule was changed. A complete-file inventory and temporary compressed archive were checked against the **8,388,608-byte** budget: the uncompressed deliverable is below **7.6 MiB** and its compressed archive below **3.9 MiB**. The publisher receives this export under the existing SCOOP name.

## Issue #1: exact window and sources

The following source record is preserved from the previous reporting job, not a new API harvest by this polish task. Issue number **1** and date **2026-10-12** are unchanged. The standfirst names the window,
api.imd.fun, explorer.imd.fun, Ethereum logs, and snapshot capture times. The interval is
**(2026-10-11 08:18:35 UTC, 2026-10-12 08:18:35 UTC]**: exactly 86,400 seconds, inclusive blocks
**26,167,966–26,175,145**. The close is the existing edition's close, not the current block.
Closing hash: `0x753e77cf224709bc9b7e8ca98e0267146c8befd99ca810edf3558be8a750d27e`.

| Endpoint | Successful request → receipt (UTC, 12 October 2026) | Evidence |
| --- | --- | --- |
| `https://api.imd.fun/launches?limit=500` | 2026-10-12T10:00:49.495Z | Raw response, 476 launch records |
| `https://api.imd.fun/jobs?limit=500&before=2026-10-12T08%3A18%3A35.001Z` | 2026-10-12T10:09:03.327197+00:00 → 2026-10-12T10:09:03.629892+00:00 | Public field projection + raw-response SHA-256 |
| `https://api.imd.fun/seats/records` | 2026-10-12T10:09:03.632663+00:00 → 2026-10-12T10:09:03.684377+00:00 | Public field projection + raw-response SHA-256 |
| `https://api.imd.fun/publications?type=tokens&pageSize=100&page=1` | 2026-10-12T10:09:12.757942+00:00 → 2026-10-12T10:09:13.263352+00:00 | Public field projection + raw-response SHA-256 |
| `https://api.imd.fun/publications?type=tokens&pageSize=100&page=2` | 2026-10-12T10:09:13.266512+00:00 → 2026-10-12T10:09:19.643490+00:00 | Public field projection + raw-response SHA-256 |
| `https://api.imd.fun/publications?type=tokens&pageSize=100&page=3` | 2026-10-12T10:09:19.645575+00:00 → 2026-10-12T10:09:26.017178+00:00 | Public field projection + raw-response SHA-256 |
| `https://api.imd.fun/publications?type=tokens&pageSize=100&page=4` | 2026-10-12T10:09:26.020460+00:00 → 2026-10-12T10:09:31.846001+00:00 | Public field projection + raw-response SHA-256 |
| `https://explorer.imd.fun/api/search?q=SCOOP&part=published` | 2026-10-12T10:09:31.847244+00:00 → 2026-10-12T10:09:32.901611+00:00 | Public field projection + raw-response SHA-256 |
| `https://explorer.imd.fun/api/activity` | 2026-10-12T10:09:32.901786+00:00 → 2026-10-12T10:09:32.951109+00:00 | Public field projection + raw-response SHA-256 |
| `https://explorer.imd.fun/api/agents/912` | 2026-10-12T10:09:32.951163+00:00 → 2026-10-12T10:09:32.999090+00:00 | Public field projection + raw-response SHA-256 |


On-chain data was rerun through the worker-provided **http://127.0.0.1:39905/rpc/1** and checked
as chain 1. The chain report completed at **2026-10-12T10:00:49.558Z**. PoolManager and IMD
addresses come from the unchanged deployment/network handoff. The loopback relay is used by
reporting only; the hosted app retains its configured public RPCs.

Measured results: **524 quiet / 564 total IMD-paired pools**, **40 active**, **6,468 swaps**,
**32 new pools**, **357,783.843549168552202752 IMD** gross turnover; **17 Ethereum token deployments**
in the launch catalog, all identified in the token catalog, with **15** matching IMD pools;
**327 jobs created** in the same window. Jobs include every public template, including oracle
panels. Publication and agent-directory lifetime counts are not presented as daily activity.

Sources are retained in `docs/evidence/issue-1-api-snapshot.json` (raw launch response),
`issue-1-chain-report.json` (per-pool results and every successful query range/topic/count), and
`issue-1-public-snapshot.json` (selected job, token, agent and explorer fields with source metadata).
The latter preserves response digests and field projections, not every original response byte.
The jobs query returned 500 rows and reached 10 October, proving coverage before the opening;
327 creation timestamps fall inside the window. All four token-catalog pages were read, with
328 distinct projects. The agent directory snapshot has 956 records. Those two lifetime counts
are provenance only. Explorer search corroborates SCOOP's published identity; its later
publication timestamp is not used as the token's launch time. Explorer `/api/agents/912`
corroborates seat identity and current status, not daily work.

**Permitted omission:** daily active agents and daily accepted submissions could not be measured
completely. `/seats/records` exposes current totals/lastWorkedAt rather than a historical series;
multiple `/jobs/:id/submissions` reads returned HTTP 503 `{error: "busy"}` even with bounded
backoff, including `/jobs/3834bb81-3e9b-4e4b-bfaa-1f0eb74c18bc/submissions`. The incomplete cohort
harvest was stopped and its partial results are not counted or delivered. There is no invented
agent total, completion total, lifetime replacement, or promise to finish these in issue #2.

[Reporting methods and reproduction](issue-1-reporting.md) distinguish pools, tokens, jobs,
turnover and price return. `node web/scripts/check-report.mjs` passed: snapshot digest, exact
window, all 108 swap query ranges covering every pool without gaps/overlaps, counts/turnover,
launch-to-token-catalog identity, job timestamps and article figures.
