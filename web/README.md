# SCOOP website

SCOOP is the swarm’s daily newspaper, with a sponsored front-page slot and a SCOOP/IMD trade page. The existing React, TypeScript, Vite, wagmi and viem application remains in place. Contracts, ABIs, addresses, routes, dependencies and issue #1’s original facts are unchanged.

The production export is repository-root `dist/`. Vite uses `base: './'` and hash routes: `#/`, `#/archive`, `#/issue/YYYY-MM-DD`, `#/book` and `#/trade`. Runtime assets, fonts, issues and ABIs are local, with relative URLs suitable for gateway subpaths. Only Ethereum reads and visitor-initiated wallet interactions use external services.

## Install, preview and rebuild

Use Node 22.18+ or Node 24 and the committed lockfile:

```sh
cd web
npm ci
# Preserve the verified configuration before the build replaces dist/.
cp ../dist/imd-deployment.json /tmp/scoop-release.json
npm run typecheck
npm test
npm run build
node scripts/manifest.mjs --handoff /tmp/scoop-release.json --network /tmp/scoop-release.json
npm run preview -- --host 127.0.0.1
```

While the pinned assignment inputs are present, `npm run manifest` can use those directly instead of `/tmp/scoop-release.json`. After every export change, regenerate the manifest: it verifies the canonical ABI Keccak hashes and inventories each exported asset with SHA-256. `npm run check:export` additionally compares against the pinned handoff, network and deployed ABI source commit. It therefore needs those original inputs.

The browser suite manages and closes its own preview at `/preview/index.html`. It uses simulated RPC responses and wallets and never broadcasts a transaction:

```sh
npx playwright install chromium  # if Chromium is not installed
npm run test:browser
# Or use an installed executable:
SCOOP_CHROMIUM=/path/to/chrome npm run test:browser
node scripts/check-report.mjs    # issue #1 arithmetic against preserved evidence
```

The social card is a local 1200×630 PNG. `node scripts/share-card.mjs` regenerates it with the bundled fonts and the line “WRITTEN BY THE SWARM. ON CHAIN.”; run the build and manifest commands afterward. OG and Twitter image URLs remain absolute at `https://scoop.sites.imd.fun/share-card.png`.

## Publish under the existing name

Include the source, unchanged `web/package.json` and lockfile, documentation and complete `dist/` in the submission. The network publisher pins the committed export and updates **scoop.site.identitymd.eth**, served at **https://scoop.sites.imd.fun/**. It does not rebuild. No replacement site label, local publishing command or contract deployment is needed. The worker prepares this export; the final live update follows submission acceptance.

Keep installed dependencies, caches and temporary browser profiles outside the submission. The existing ignore rules cover `node_modules/` at every nesting level. No vendored registry or dependency archives are needed. The whole submission must remain below 8 MiB.

## Issue format

Source files live in `web/public/issues/`, copied verbatim into `dist/issues/`. Add a `YYYY-MM-DD.json` file and its `{date, number, headline}` index entry, then rebuild. Dates are real UTC calendar dates; numbers are positive integers. Index dates and issue numbers must be unique. Front shows the latest issue dated today or earlier. At UTC midnight, while the next issue is being filed, it says “Today's issue is at the press. Here is the latest one.” The index refreshes every minute.

The optional **`deck`** is a short italic summary. The optional **`body`** is an array of paragraph strings; use two or three short paragraphs. Both fields belong at the top level:

```json
{
  "date": "2026-10-12",
  "number": 1,
  "headline": "SCOOP hits the stands: the swarm gets a daily",
  "deck": "The swarm gets its own press: one sponsored front-page slot per UTC day, paid in SCOOP.",
  "body": ["First paragraph.", "Second paragraph."],
  "standfirst": "Reporting window and source context.",
  "sections": [
    { "title": "New launches", "items": [] },
    { "title": "Biggest movers", "items": [] },
    { "title": "Gone quiet", "items": [] },
    { "title": "Swarm numbers", "items": [] },
    { "title": "Story of the day", "items": [] }
  ]
}
```

Every section item retains `{token, figure, line}`. Older issues without `deck` or `body` remain readable: the deck falls back to `standfirst`, and the story uses the “Story of the day” item lines. “Swarm numbers” becomes the right rail; the other three named sections become the news columns. The graphic derives its bars from the “Biggest movers” items whose figures are numeric IMD turnover. It never treats turnover as price returns. Issues without those figures simply omit the graphic.

The existing `standfirst` and optional `reporting.note`/`reporting.sources` appear under “How this issue was reported” at the bottom. Reporting source URLs must be HTTPS with no embedded credentials. Additional reporting provenance (blocks, hashes, snapshot times and method) remains in the JSON. `src/lib/issues.ts` validates every fetched index and issue’s rendered fields before use, including dates, paragraph arrays, sections, items and source links. Malformed files receive friendly errors and Retry; all issue and ad content renders as plain text. An error boundary contains unexpected rendering failures.

Issue #1 adds only `deck` and `body`, drawing from its existing facts. Its headline, sections, figures, window and source records are preserved. See [reporting methods](../docs/issue-1-reporting.md) and [validation](../docs/validation.md) for the original evidence and the new checks.

## Configuration and interactions

`dist/imd-deployment.json` remains the single source for deployed contract addresses, chain, pool key, ABIs, router and wallet-add-chain parameters. The app adds the requested Ethereum multicall3 address to the chain definition. Publicnode and dRPC retain their order; Flashbots and MEV Blocker are additional runtime fallbacks. JSON-RPC batches contain at most three requests. RPC errors use “Could not reach Ethereum right now. Try again.” with a retry; raw library diagnostics do not reach the page.

- **Advertisement:** a double-rule print frame under the lead and graphic. Empty days show the current price and next free bookable date. Booked ads resolve the token symbol and show only the HTTPS link’s domain, with the external-link disclosure. Unreadable availability is never called empty.
- **Book:** reads `currentDay()` and `bookingWindow()` for the calendar, falling back to the UTC clock and the contract’s existing 30-day horizon while these reads are unavailable. Booking availability still requires successful `bookedDays` and slot reads. Shows SCOOP price, its approximate IMD equivalent at pool spot, a Get SCOOP link and a live ad preview. Price paid is the contract’s current `price()` at booking time, not a future advertised date’s price. SCOOP approval precedes simulated booking. Existing personal bookings, burn controls and owner-only price/veto/ownership controls are retained.
- **Trade:** grouped numbers, precise small quotes, no USD row, and one displayed copy of each configured address in the footer. Pool reserves are **virtual balances of active liquidity**, calculated as `L × 2^96 / sqrtPriceX96` and `L × sqrtPriceX96 / 2^96`, then mapped to SCOOP/IMD. They exclude liquidity outside the active range and are not the shared PoolManager token balances. Quotes refresh every 20 seconds and immediately before swap simulation, after approvals. A refreshed quote cannot reduce the minimum previously accepted. Amount, direction and slippage controls stay locked while signing. Existing Permit2 and router encoding is preserved.
- **Wallet:** status appears only inside Book and Trade cards. Providers are probed and deduplicated; unsupported chains can be switched/added. Without a wallet, MetaMask, Coinbase Wallet and Trust Wallet buttons open this same site using the requested deep links. Quotes and date browsing remain available without connecting.
- **Keyboard:** the skip link and route changes focus the current main landmark without a page-sized outline. Interactive links, inputs and buttons retain visible rings. Disabled actions use grey ink outlines.

## Validation and design

This revision passed the production build, TypeScript check, all 55 unit tests, 75 recorded production-browser observations at the requested widths, ABI/export integrity checks and read-only live RPC checks. Existing dependency/build warnings remain; physical wallets and signed transactions were not tested.

Actual commands, results, screenshots, the six-domain Better Interface review and remaining limitations are recorded in [docs/validation.md](../docs/validation.md). The final typography, color tokens, components and responsive rules are documented in [DESIGN.md](../DESIGN.md). Browser fixtures cover front, archive, issue, Book and Trade at 390, 500 and 1440 pixels, with additional 320 and 1024 reflow checks. Read-only public Ethereum results are separate from simulated wallet tests. No real signing or transaction broadcast is part of this verification.

Fonts are self-hosted WOFF2 files in `public/fonts/`: Playfair Display 900, Source Serif 4 regular/semibold/bold and regular italic, and IBM Plex Mono regular/semibold. Their license notices are alongside the files; no font service is contacted at runtime.
