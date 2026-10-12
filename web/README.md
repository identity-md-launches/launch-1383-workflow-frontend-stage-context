# SCOOP website

Static front end for the SCOOP launch: the daily front page, the sponsored-slot booking flow
(`ScoopFrontPage`), and buying/selling SCOOP in its Uniswap v4 launch pool. Vite + React +
TypeScript with wagmi/viem. The export under repository-root `dist/` is what gets pinned; it uses a
relative base and hash routing, so it works from an IPFS gateway subpath or an ENS name with no
server rewrites.

## Configuration: one file

The app has **no** address, chain, ABI or RPC table in its source. At start-up it fetches
`./imd-deployment.json` (generated into `dist/` by `scripts/manifest.mjs`) and the ABI files it
points at (`abi/LaunchToken.json`, `abi/ScoopFrontPage.json`). From that one file it takes:

- `chainId`, `contracts[]` (addresses, ABI paths), `poolKey` (the exact Uniswap v4 pool key);
- `network` (name, public `rpcUrls`, explorer, Uniswap v4 `universalRouter`, `quoter`, `stateView`,
  `permit2`, `pairToken`), copied unchanged from `.imd/reads/network.json`;
- `walletAddChain`, the exact `wallet_addEthereumChain` parameters, used when the wallet does not
  know the chain.

Public RPC endpoints only; there are no credentials, no WalletConnect project id (only injected
EIP-1193 wallets are offered; a WalletConnect connector can be added to `src/main.tsx` if a public
project id is supplied) and no trackers.

Pages (hash routes): `#/` front page, `#/archive`, `#/issue/YYYY-MM-DD`, `#/book`, `#/trade`.

## Issues

Issues are static JSON files served from `issues/` in the export (source: `web/public/issues/`).
`issues/index.json` lists every issue; the front page shows today's issue when one exists,
otherwise the newest. To add a day, write `web/public/issues/YYYY-MM-DD.json` and append to
`index.json`, then rebuild.

```json
{
  "date": "2026-10-12",
  "number": 1,
  "headline": "string",
  "standfirst": "optional string",
  "sections": [
    { "title": "New launches",     "items": [ { "token": "SCOOP", "figure": "block 26,175,124", "line": "one line" } ] },
    { "title": "Biggest movers",   "items": [] },
    { "title": "Gone quiet",       "items": [] },
    { "title": "Swarm numbers",    "items": [] },
    { "title": "Story of the day", "items": [] }
  ]
}
```

`index.json` entries are `{ "date", "number", "headline" }`. All text is rendered as plain text.
Issue #1 combines the timestamped IMD public API snapshot with the complete 24-hour Ethereum
pool scan documented in [`docs/issue-1-reporting.md`](../docs/issue-1-reporting.md). The optional
`reporting` object records `chainId`, `fromBlock`, `toBlock`, exclusive `after` and inclusive
`through` UTC timestamps, `closingHash`, `apiSnapshot`, `apiEndpoint` and the calculation `method`.
It is provenance, not runtime deployment configuration. Retain the edition's source snapshot
and distinguish later API retrieval time from the historical trading window.

## Contract controls

- **Sponsored slot** (front page, above the fold): `slotOf(today)` rendered as plain text.
- **Book**: calendar of the 30 bookable days (`bookedDays`, booked or unknown days disabled), form validated
  client-side with the contract's rules, live `price()` / `nextPrice()`, then two wallet steps:
  `approve(frontPage, price)` on SCOOP (skipped when the allowance already suffices) and `book`
  (simulated first; the revert reason is shown instead of asking the wallet).
- **Your bookings** and a **ledger** of every booking in the window; loading and failed reads
  remain distinct from a successful empty result, with a Retry bookings control on failure; **Burn** on ended, unburned
  days (anyone).
- **Editor's desk** (shown only to the connected owner / pending owner): `setPrice`, `veto` per
  upcoming booking (with confirmation), `transferOwnership`, `acceptOwnership`.
- **Trade**: spot from `StateView.getSlot0`, quote from `Quoter.quoteExactInputSingle` by
  simulation, validated 0–50% slippage applied, then `approve(permit2)` → `Permit2.approve(token, router)` →
  `UniversalRouter.execute(0x10, [V4_SWAP 0x060c0f])`, each step skipped when already satisfied
  and the swap simulated before signing. Both pool currencies are ERC-20s, so no ETH value is sent.
- **Wrong network**: a single "Switch to Ethereum" control; on error 4902 / unknown chain it sends
  `wallet_addEthereumChain` with `walletAddChain` and switches again. Both booking and trading use
  the connector’s actual chain ID and a matching wallet client, including unsupported-chain changes.
- **No wallet installed**: only connectors with an available provider are offered; otherwise
  explain how to install a browser wallet or open the page in a wallet browser.
- **Skip to content**: focuses the current main landmark without changing the hash route or form values.

## Build

```sh
cd web
npm ci                       # Node 22; lockfile is package-lock.json
npm run typecheck            # tsc --noEmit
npm test                     # vitest: day math, validation, chain switch, swap encoding, config loader
npx vite build               # writes ../dist with base ./
node scripts/manifest.mjs    # writes ../dist/imd-deployment.json (ABI hash check + SHA-256 of every file)
npm run check:export         # pinned ABI commit, handoff, network and complete asset inventory
npx playwright install chromium  # once, for the browser regression suite
npm run test:browser         # starts and closes its own subpath preview; mocked wallet/RPC only
npx vite preview --outDir ../dist   # local preview
```

`npm run build` runs typecheck + vite build. Run the manifest script after **every** export change;
it refuses when an ABI's canonical Keccak hash differs from the handoff.


When the pinned worker inputs have been removed, preserve the committed runtime configuration
**before building**: `cp ../dist/imd-deployment.json /tmp/scoop-deployment.json`. Then run the
manifest command with `--handoff /tmp/scoop-deployment.json --network /tmp/scoop-deployment.json`.
Keep `docs/abi/` at the attested versions. `check:export` additionally needs the original pinned
handoff and network inputs to perform its independent comparison.

The regression suite tests the production export with simulated RPC and injected-wallet states;
it never broadcasts a transaction. Set `SCOOP_CHROMIUM` to an existing Chromium executable if
needed. Evidence and screenshots are under `docs/evidence/`; see `docs/validation.md` for results
and remaining live-wallet limitations. `--reproduce` on the browser script is intended for the
pre-revision export and records the original defects; use the normal command for the final app.

The static `share-card.png` is 1200×630 and uses the existing masthead/paper/ink/red identity.
`node scripts/share-card.mjs` recreates it using Playwright. Relative OG/Twitter image paths work
under gateway subpaths; an absolute canonical social URL is pending the publisher's chosen URL.
Regenerate the export and deployment inventory if that metadata changes after publication.
