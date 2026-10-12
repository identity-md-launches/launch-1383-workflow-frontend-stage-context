# SCOOP revision validation

Worker evidence for the eight reported findings. This record supersedes the previous round's
incomplete reporting and interaction claims; it is not independent network certification.
Contracts, root build configuration, deployed addresses and ABIs are unchanged. Source remains
in `web/`, the static export in `dist/`, and documentation in `docs/`. `docs/DESIGN.md` remains the
design document because the explicit write scope excludes a root `DESIGN.md`.

## Reporting correction

Issue #1 now uses `https://api.imd.fun/launches?limit=500`, captured at
**2026-10-12T09:03:59.143Z**, and complete on-chain pool data for
**(2026-10-11 08:18:35 UTC, 2026-10-12 08:18:35 UTC]**. Inclusive blocks:
**26,167,966–26,175,145**. The original close is preserved; its approximate opening block was
four minutes early and is corrected from timestamps. API deployment block numbers select
historical launches; a later API status is not presented as historical status.

Results: **524 quiet / 564 total pools**, 40 active pools, 6,468 swaps, 32 newly initialized pools,
and 17 Ethereum token deployments in the API catalog during this window. All hooks and both
currency orderings are covered. The article distinguishes pool counts, catalog deployments and
IMD turnover. Full endpoints, definitions, closing hash, calculation and reproduction command:
[issue-1-reporting.md](issue-1-reporting.md). Original API bytes and per-pool integer results/query
coverage are retained in `docs/evidence/issue-1-*.json`. The snapshot hash, complete per-pool range
coverage and all article aggregates were checked locally. No partial-window count is used.

## Finding dispositions and rechecks

The production export from the accepted commit was served under a `/preview/` subpath before
editing. Reproduction used Chromium 154.0.8037.0 at 390×844 and 1440×900, with JSON-RPC and
EIP-1193 fixtures (no real wallet or funds). Recorded observations:
[evidence/reproduction.json](evidence/reproduction.json). All eight findings were addressed:

| Finding ID prefix | Source | Reproduced behavior → correction and recheck |
| --- | --- | --- |
| `05f6bdbb` (high) | `web/public/issues/2026-10-12.json:5` | Original standfirst admitted no API reporting; Gone quiet substituted the lifetime count. Completed API + exact-window reporting and replaced every affected figure. Final home/issue renders the measured 524-of-564 result. |
| `db484b7e` | `web/index.html:11` | `og:image` was absent. Added a 1200×630 PNG, OG/Twitter image metadata and alt text. Browser resolves the relative image to an exported PNG; it is included in the regenerated asset hashes. Actual social-service unfurl is pending publication. |
| `bbbd86cd` | `web/src/App.tsx:36` | Skip changed `#/trade` to `#main` and destroyed amount input. Handler prevents default navigation and focuses/scrolls `main`. Keyboard Enter now preserves trade/book/archive routes, trade amount and booking headline. |
| `ffc3a2ea` | `web/src/components/Trade.tsx:36,62,67,117`; `web/src/lib/format.ts:33` | 100% produced zero minimum and an enabled swap/approval plan. Finite 0–50% validation is applied before minimum calculation and in the handler. Invalid, negative, empty and overflowing values show the specified inline error, `aria-invalid`, no minimum and no executable plan. 0, 1 and 50 remain valid. |
| `91cd6df7` | `web/src/components/Book.tsx:35,132,179,191` | RPC errors left 30 selectable days and false empty ledger/own-booking copy. Separate availability and slot-read status gates now disable unknown days, show loading/error states and Retry bookings. Error fixture: 0 enabled days; retry recovers to 29 available/1 booked. Individual slot failures never become empty lists; a successful empty response does. The owner's booking list uses the same status. |
| `4d15b1be` | `web/src/hooks.ts:19,22,28,51` | Switching away to chain 10 reproduced an Ethereum badge and enabled Swap. The report's initial-switch failure did not occur in this fixture, but the stale-client root cause did. Use `useAccount().chainId` to key the wallet-client query and require an actual chain/client/account match. Both trade and booking gates now disable when switching away and recover when switching back without remounting. |
| `01409bc9` | `web/src/components/Trade.tsx:98,101,134`; `web/src/styles.css:136` | At 390 px the amount field began at y≈1189 with pool details first. The card is now first in DOM/mobile order, at y≈650, with pool details below. Desktop still has details left/card right (input y≈565). Removed the redundant kicker and shortened the intro to the computed pool fee. |
| `e5dd46d5` | `web/src/components/WalletBar.tsx:16,31,45` | No-provider context offered Connect Injected and returned the raw Provider not found/version error. Provider availability is now checked before offering a connector, generic choice is Connect wallet, named discovered providers retain their name, and missing-provider errors receive actionable guidance. No-provider and named-wallet fixtures pass. |

## Build and integrity checks

Commands ran locally on the delivered source/export:

| Command | Result |
| --- | --- |
| `npm ci --cache /tmp/scoop-npm-cache --no-audit --no-fund` | Installed from the existing lockfile; then added Playwright as a dev dependency and retained the updated lockfile for submission. Cache stays outside Git. |
| `npm run typecheck` | Passed (TypeScript). |
| `npm test` | 5 files, **21 tests passed**: existing chain/config/day/validation/swap coverage plus invalid-slippage boundaries. |
| `npm run build` | Passed; relative-base Vite export. Nonfatal third-party PURE-comment warnings and the existing >500 kB JS-chunk warning. No dependency or root build rewrite. |
| `npm run manifest` | 9 assets, **723,828 bytes** excluding the manifest; SHA-256 inventory regenerated after final static build. |
| `npm run check:export` | Passed: exact handoff identity/contract set, pool key, network and walletAddChain; complete asset inventory/hashes/path limits; both canonical Keccak ABI hashes; ABIs compared with `git show` at deployed source commit `387e2fe049a33d3c33318ef0b6ef86bb5d65506a`. |
| `npm run test:browser` with `SCOOP_CHROMIUM` pointing to the installed browser | Passed against the final production export; fixtures and screenshots described below. |
| `git diff --check` | Passed. |

The app still loads `imd-deployment.json` and its referenced ABI files at runtime. No secondary
address/chain map or private RPC value was introduced. Test wallet addresses live only in the
browser fixture and are not included in the static runtime bundle. Existing offline dependency
policy is unchanged; no node_modules, package cache, archive mirror or submodule is submitted.

Read-only Ethereum verification at block **26,175,407**, using the worker relay: chain 1; deployed
code lengths 1,752 bytes (LaunchToken) and 5,717 bytes (ScoopFrontPage); price 2,000,000 SCOOP;
quotes succeeded in both directions. Exact amounts, timestamp and block hash:
[evidence/live-reads.json](evidence/live-reads.json). This is separate from issue #1's historical
window. No transaction was broadcast.

## Browser and interaction coverage

The supplied browser connector returned `Transport closed`; local Playwright provided the actual
browser checks. The bounded script owns its HTTP server/browser and closes both on completion.
The export is served at `/preview/index.html`, exercising relative assets and hash routes.

[evidence/browser-results.json](evidence/browser-results.json) records the final assertions and
measurements. It reports **zero console errors and zero failed local asset responses**. The suite
checks the following at 390×844 and 1440×900:

- No wallet, available injected wallet and named EIP-6963 discovery; wallet rejection feedback.
- Wrong-chain → Ethereum → unsupported chain → Ethereum, both trading and booking gates;
  error 4902 triggers the exact manifest walletAddChain payload, then a successful switch.
- Quote controls, slippage errors/boundaries, minimum output, disabled actions and a forced click
  attempt while invalid. A valid approval request is deliberately rejected by the mock provider;
  the app unlocks and shows the rejection. No signing request leaves the fixture.
- Keyboard skip activation in trade/book/archive; route and typed input preservation.
- Booking initial loading, global RPC error, successful empty data, nonempty lists, partial slot
  failure and retry recovery. Only successful booking reads authorize calendar selection.
- All four pages at 320, 390, 768 and 1440 CSS px: no horizontal document overflow.

Screenshots of the final front page, trade, booking and archive at 390 and 1440 px are saved under
`docs/evidence/{front,trade,book,archive}-{390,1440}.png` and were visually inspected. They use
**fixture chain data**, not live balances/prices. The red outline around `main` on routed pages is
the existing focus indicator, not a new card border. The 1200×630 share card was inspected too.

## Better Interface review — six domains

Applied the pinned Better Interface and eth-frontend-ux guides to the revised surfaces, retaining
the accepted paper/ink/red visual direction. Design facts are in [DESIGN.md](DESIGN.md).

| Domain | Coverage | Findings / limits |
| --- | --- | --- |
| Accessibility | Checked: source, keyboard and rendered UI | Skip now preserves forms; errors are linked to the slippage input; unknown dates are disabled and labelled. Focus ring, labels, native controls and pressed states retained. Screen-reader session, native zoom, forced-colors and full automated accessibility audit not performed. |
| Layout | Checked: 320/390/768/1440 reflow; mobile and desktop screenshots | Primary trade controls now precede secondary data on phones. Desktop columns retained, addresses wrap, no document overflow. RTL/localization and physical-device layouts not tested; English is the shipped language. |
| Writing | Checked: revised copy and source | API/time window and quiet/turnover metrics explicit; actionable no-wallet/retry/slippage errors; no claim that unknown availability is empty. No unrelated editorial redesign. |
| Typography | Checked: source and screenshots | Existing serif headlines/body, sans controls, mono figures retained. Real report text fits mobile and three-column desktop layout. System font fallback varies by device; exact installed face/weight coverage across platforms unverified. |
| Colors | Checked: source palette and rendered surfaces | Existing hex tokens retained; no gradients or new accent. Text labels supplement error/selection colors. No new pixel-sampled contrast measurement was made; prior token-only contrast estimates are not promoted to rendered measurements. |
| UI | Checked: relevant states and interactions | Loading/error/empty lists distinct, retry works, chain badges and action gates follow events, provider choices reflect availability. Share metadata points to the local asset. Live social crawler behavior remains unverified. |

## Completion and limitations

Complete for the revision's worker-delivery scope: eight finding responses, targeted source
changes, final static export and validation evidence ready for the worker's submission step. No real-wallet transaction, approval,
booking, owner write, burn or swap was broadcast; mined transaction outcomes and physical wallets
remain untested. WebKit/Safari, screen readers and native 200% zoom were not tested. RPC data in
browser tests is mocked; live read/quote evidence is recorded separately. This worker neither
publishes the site nor runs the control plane's eventual IPFS/named-site checks. Relative social
image paths await an absolute canonical URL once the publisher chooses the hosted entrypoint.


## Submission boundary

`git add web dist docs` was attempted and refused by the workspace's read-only Git metadata:
`Unable to create .../.git/index.lock: Read-only file system`. No local commit was created and no
Git metadata permissions were changed. The network worker must stage/commit the delivered files.
`.imd-responses.json` exists in the repository root for its revision-response ingestion.

A direct candidate-tree check using tracked files plus nonignored new files (excluding deleted
old bundles and the worker-consumed response JSON) found no out-of-scope changes, no submodules,
and no dependency/cache archives. The complete candidate tar is about **6.25 MB**, below the
8,388,608-byte cap; the hosted export is only 723,828 asset bytes plus its manifest. Documentation
and validation screenshots stay outside the hosted export.
