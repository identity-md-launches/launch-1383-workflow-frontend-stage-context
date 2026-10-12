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
Issue #1 was written from on-chain data only (see `docs/validation.md`): IMD's public API was not
reachable from this worker.

## Contract controls

- **Sponsored slot** (front page, above the fold): `slotOf(today)` rendered as plain text.
- **Book**: calendar of the 30 bookable days (`bookedDays`, booked days disabled), form validated
  client-side with the contract's rules, live `price()` / `nextPrice()`, then two wallet steps:
  `approve(frontPage, price)` on SCOOP (skipped when the allowance already suffices) and `book`
  (simulated first; the revert reason is shown instead of asking the wallet).
- **Your bookings** and a **ledger** of every booking in the window; **Burn** on ended, unburned
  days (anyone).
- **Editor's desk** (shown only to the connected owner / pending owner): `setPrice`, `veto` per
  upcoming booking (with confirmation), `transferOwnership`, `acceptOwnership`.
- **Trade**: spot from `StateView.getSlot0`, quote from `Quoter.quoteExactInputSingle` by
  simulation, slippage applied, then `approve(permit2)` → `Permit2.approve(token, router)` →
  `UniversalRouter.execute(0x10, [V4_SWAP 0x060c0f])`, each step skipped when already satisfied
  and the swap simulated before signing. Both pool currencies are ERC-20s, so no ETH value is sent.
- **Wrong network**: a single "Switch to Ethereum" control; on error 4902 / unknown chain it sends
  `wallet_addEthereumChain` with `walletAddChain` and switches again.

## Build

```sh
cd web
npm ci                       # Node 22; lockfile is package-lock.json
npm run typecheck            # tsc --noEmit
npm test                     # vitest: day math, validation, chain switch, swap encoding, config loader
npx vite build               # writes ../dist with base ./
node scripts/manifest.mjs    # writes ../dist/imd-deployment.json (ABI hash check + SHA-256 of every file)
npx vite preview --outDir ../dist   # local preview
```

`npm run build` runs typecheck + vite build. Run the manifest script after **every** export change;
it refuses when an ABI's canonical Keccak hash differs from the handoff.
