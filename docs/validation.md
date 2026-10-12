# SCOOP implementation validation

Complete for the stated website scope, with the permitted omission of unmeasurable daily agent
and acceptance totals. This is worker evidence, not independent certification. This record
supersedes the earlier revision report. No contracts, deployment addresses, ABIs, dependencies,
lockfiles, protected build configuration, or ignore rules were changed.

## Issue #1: exact window and sources

Issue number **1** and date **2026-10-12** are preserved. The standfirst now names the window,
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

## Requested behavior and tests

| Item | Implementation / source | Actual validation |
| --- | --- | --- |
| Issue | `web/public/issues/2026-10-12.json:5`, `web/src/components/Issue.tsx:55` | Measured window/sources, new-job count, linked source note. Offline report arithmetic passed; front/archived issue rendered. |
| Share card | `web/index.html:12`, `web/public/share-card.png` | Retained the existing inspected 1200×630 paper/ink/red card. OG and Twitter image URLs are now absolute on scoop.sites.imd.fun; summary_large_image. PNG signature, IHDR, copied bytes and metadata checked. |
| Slippage | `web/src/lib/format.ts:30`, `web/src/components/Trade.tsx:67` | Existing finite 0–50 validation retained and regression coverage expanded. Empty, negative, overflow and >50 values show the exact linked error and disable Swap. Forced clicks produce no wallet plan; boundaries 0/50 work. |
| Bookings | `web/src/components/Book.tsx:38`, `:137`, `:180`, `:188` | Fixed selection/submit gating to require all needed slot reads as well as bookedDays. Initial loading, delayed slots, global error, per-slot failure, retry, nonempty and successful empty states pass. A forced click cannot select an unknown day. Ledger and wallet list never label failures empty. |
| Network | `web/src/hooks.ts:22`, `:28` | Badge derives from useAccount chain directly; writes additionally require a matching wallet client/account. A delayed client no longer causes a false Wrong network badge. Tests switch away/back on Book and Trade without remounting, including unsupported chain and add-chain recovery. |
| No wallet | `web/src/components/WalletBar.tsx:17`, `web/src/lib/format.ts:48` | Providers probed before offering connectors, duplicate provider removed, every button says Connect wallet. No-provider and discovered-wallet fixtures pass; raw missing-provider errors become exact installation guidance, including error-helper tests. |
| Mobile Trade | `web/src/components/Trade.tsx:102`, `web/src/styles.css:145` | Card first on phone, details below, two desktop columns retained. Required fee intro, no launch kicker. Swap bottom y=798.69 at 390×844; amount y=518.69. |
| Skip | `web/src/App.tsx:36` | Existing preventDefault + focus + scroll preserved. Keyboard Enter retains trade/book/archive hashes, amount and all booking fields/selected day. |

## Commands and outcomes

Run from `web/` unless stated otherwise:

| Command | Outcome |
| --- | --- |
| `npm ci --cache /tmp/scoop-seat4-c5871b7a-npm --no-audit --no-fund` | Passed; existing manifests and lockfile preserved. An initial attempt used a nonwritable pre-existing /tmp cache; switching to this task's cache fixed installation. Existing peer/deprecation warnings remain. |
| `npm test` | Passed: **6 files, 25 tests**. Existing 21 tests plus 4 wallet-error cases; slippage edge cases expanded. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed after final runtime change. Existing third-party PURE-annotation warnings and >500 kB JS-chunk warning remain; no missing asset/build error. |
| `npm run manifest` | Passed, all 9 assets inventoried. |
| `npm run check:export` | Passed: **727,500 asset bytes** excluding the manifest, both canonical ABI hashes, comparison with deployed source commit, exact handoff/network/pool key, complete asset hashes, metadata, 1200×630 PNG and issue byte copy. |
| `node scripts/report-issue.mjs http://127.0.0.1:39905/rpc/1` | Complete historical chain scan passed; no partial-window count. |
| `python3 scripts/snapshot-issue.py` | Completed jobs, token catalog, agent directory and explorer snapshot; omitted historical agent metric as described above. |
| `node scripts/check-report.mjs` | Passed offline arithmetic/provenance checks. |
| `npm run test:browser` with installed Chromium and writable XDG dirs | Passed production-export fixture checks; details below. |
| `git diff --check` | Passed. |

The supplied browser connector returned **Transport closed**. Local Playwright with Chromium
**154.0.8037.0** performed the rendered checks. Chromium's first launch failed because its default
profile/config directory was unwritable; the following task-specific environment succeeded:

```sh
XDG_CONFIG_HOME=/tmp/scoop-seat4-chrome-config \
XDG_CACHE_HOME=/tmp/scoop-seat4-chrome-cache \
SCOOP_CHROMIUM=/opt/imd-tools/ms-playwright/chromium-1246/chrome-linux64/chrome \
npm run test:browser
```

The foreground harness serves `/preview/index.html` and closes both browser and server. Final
results and timestamps are in [browser-results.json](evidence/browser-results.json). Zero page or
console errors and zero failed local asset responses were recorded. Screenshots use fixture
RPC data and wallets, not live balances/quotes. Front page, archive, issue #1, Book and Trade were
inspected at **390×844 and 1440×900**; all five also passed document-overflow checks at **320 and
768px**. Screenshots: `docs/evidence/{front,archive,issue,book,trade}-{390,1440}.png`. A focused
keyboard view is in `keyboard-trade-390.png`. Each was visually inspected; the archive's broken
“No.” header was fixed and rechecked. First selectable booking day ends at y=807.69 on the phone.

Read-only live check at **2026-10-12T10:14:13.450Z**, Ethereum block **26,175,723**: configured token
and booking contract have code (1,752 and 5,717 bytes), price is 2,000,000 SCOOP. Runtime hashes and
block hash are in [live-reads.json](evidence/live-reads.json). No transaction was broadcast.

## Better Interface: consolidated six-domain review

Applied the pinned guide during implementation and inspected the final export. Design decisions
are documented from source in [root DESIGN.md](../DESIGN.md); attributions/licenses are retained.

| Domain | Coverage | Findings, correction and evidence |
| --- | --- | --- |
| Accessibility | Checked: source, keyboard, rendered names/states | HIGH: booking enabled while slots were unknown (`Book.tsx:137`); corrected shared readiness gate. Linked slippage error, native disabled states, keyboard skip and native rules disclosure checked. Visible main focus inspected. Screen-reader sessions and forced-colors mode unperformed. |
| Layout | Checked: five routes, four widths | MEDIUM: controls too low on phone (`styles.css:145`, `Trade.tsx:102`). Two-row navigation, removed repeated wallet prose, action before steps, compact booking rules. Swap/calendar now within first 844px; desktop columns remain. No document overflow. |
| Writing | Checked: source and rendered states | HIGH: badge called a correct chain wrong while client loaded (`hooks.ts:28`); distinct chain identity and write readiness. Reporting names metric/window/source; failures give retry/install guidance. Redundant kickers and archive implementation jargon removed. |
| Typography | Checked: source and screenshots | MEDIUM: scattered size values consolidated into six semantic tokens (`styles.css:17`). LOW: archive “No.” split across lines (`Archive.tsx:13`); nowrap on that header. System serif/sans/mono stacks, readable measure and tabular figures preserved. |
| Colors | Checked: computed rendered pairs | Ink/paper **16.59:1**; ink/surface **18.37:1**; hints/surface **5.48:1**; active red/paper **5.81:1**; white/red action **6.54:1**. All measured text pairs exceed 4.5:1. No blanket certification of every possible focus/background/state. |
| UI | Checked: primary controls, loading/error/empty/retry | HIGH: calendar/ledger errors could disagree; now share readiness/failure. Provider choices deduplicated. Transaction rejection unlocks the form with clear feedback. No custom dialog, theme switch, icon system or motion sequence is present; those guide topics are not applicable. Existing owner confirmations were not exercised. |

A 200% root-font enlargement on Trade passed without horizontal document overflow. Native
browser 200% zoom, screen readers, physical phones, RTL/localization, live extensions and real
book/swap/burn/owner transaction completion were **not tested**. Only local fixture signing requests
were issued and rejected. Both Buy/Sell quotes, client-side archive navigation and recovery after
rejected booking/swap approvals were exercised. Final IPFS/ENS publication and social-service unfurling happen after
network acceptance; this task supplies the replacement export for the existing SCOOP name.


## Submission integrity and publication

The candidate tree is approximately **7.24 MB uncompressed**, below **8,388,608 bytes**, including
source, unchanged dependencies required by the existing contracts, the lockfile, complete static
export and reporting/browser evidence. No node_modules, package caches, dependency archives or
submodules are included. No ignore file was changed. The final export uses relative runtime
asset URLs; only the requested social/canonical URLs are absolute.

`git diff --exit-code` passed for `src/`, `script/`, existing contract tests, `docs/abi/`, `lib/`,
Foundry config/locks/remappings, launch manifest, frontend package/lock/build config, and both
source/export ABI directories. The existing source-commit comparison also passed. Repository metadata was not edited manually; `.github/`, environment files and deployment
state were not changed. The network worker records
the final Git submission; the publisher then updates **scoop.site.identitymd.eth** rather than
creating another site name. This local run does not claim that the live name has already changed.
