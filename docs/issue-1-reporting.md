# Issue #1 reporting record

The revision replaces the launch issue's incomplete reporting with a timestamped public API
snapshot and a complete Ethereum Uniswap v4 scan. The closing block is the original issue's
26,175,145. No later swaps are included.

## Sources and timestamps

- Public API: `GET https://api.imd.fun/launches?limit=500`, requested at
  **2026-10-12T09:03:59.143Z**. The response contains all 475 records reported by its `count`.
  [Original response bytes](evidence/issue-1-api-snapshot.json) are retained; their SHA-256 is in
  [the reporting record](evidence/issue-1-chain-report.json), together with the HTTP Date header.
  The endpoint was located through IMD's public [API guide](https://imd.fun/docs/).
- Ethereum reads: the worker-provided `http://127.0.0.1:43137/rpc/1`, chain ID checked as 1.
  This loopback endpoint is used only by the reporting command, never by the hosted app.
  PoolManager and IMD addresses come from the runtime manifest's unchanged network block.
- **Window: (2026-10-11 08:18:35 UTC, 2026-10-12 08:18:35 UTC]**. Block timestamps give inclusive
  blocks **26,167,966–26,175,145**, with no gap. Block 26,167,965 is exactly at the excluded
  opening timestamp. The earlier issue estimated 7,200 blocks as 24 hours; that interval actually
  started at 08:14:35, four minutes too early. The revision retains its close and corrects the start.
- Closing block hash:
  `0x753e77cf224709bc9b7e8ca98e0267146c8befd99ca810edf3558be8a750d27e`.
  The reporting JSON also records the first included block hash and boundary timestamps.

The API was retrieved after the close. Its historical deployment block numbers identify launches
inside the window; present-day status and counts are **not** represented as historical status.
The API query is unfiltered; Ethereum and block filters are applied locally. Seventeen catalog
records have a token deployed in the window, and 15 of those tokens match IMD-paired pools in the
chain census. This is a catalog count, not a claim that it covers every token or pool on Ethereum.

## Definitions and calculation

1. Query `Initialize` logs from block 0 through the close for the configured PoolManager, with
   IMD in either indexed currency position; deduplicate by pool ID. This gives **564 pools**.
   All hooks and fee tiers are included, including native ETH/IMD pools. A pool is not a token:
   one token can have multiple pools, and different tokens can share a symbol.
2. Query `Swap` logs for every one of those pool IDs across the entire window, in batches of
   32 IDs and at most 1,200 blocks. Split a range further on failure; no partial-window fallback.
   Sort events by block and log index; reject duplicate transaction-hash/log-index pairs.
3. **Quiet** means zero `Swap` events in this interval, not abandoned or worthless. The result is
   **524 quiet / 40 active**, summing to 564. Thirteen quiet pools were first initialized inside
   the interval; the remainder existed before it. Newly opened pools are explicitly included.
4. There are **6,468 swap events**, with **357,783.843549168552202752 IMD** gross turnover, defined
   as `sum(abs(IMD amount))` across those events. Count the IMD leg once, without adding the other
   currency or converting to USD. Multiple pool legs of a routed trade remain separate events.
5. **32 pools initialized** inside the same window. This on-chain pool census is broader than
   the public catalog's 17 Ethereum token-deployment records.
6. “Biggest movers” explicitly ranks individual pools by IMD turnover, not by token price return.
   The largest pool is the ETH/IMD 1% pool (160,430.923994243731648215 IMD, 1,610 swaps); the largest
   non-native-token pool is INFER (86,941.689434702296287416 IMD, 987 swaps), followed by MARG
   (36,331.416839288153537896 IMD, 1,138 swaps). Symbols and decimals are read at the closing block.
7. SCOOP's pool recorded 6 swaps, 15,480,115.432995101497460247 SCOOP and 40.126538509024635471 IMD.
   Its last swap's `sqrtPriceX96` gives approximately 0.000002606 IMD/SCOOP. OFFSETS is disambiguated
   using API launch numbers and token addresses: #1370 and #1372 are separate deployments.

## Reproduction and checks

From `web/`, with installed lockfile dependencies:

```sh
node scripts/report-issue.mjs http://127.0.0.1:43137/rpc/1
```

On another machine supply an accessible Ethereum archive RPC explicitly. The script requires no
wallet or authentication and never sends transactions. It overwrites the two reporting evidence
files with a fresh retrieval timestamp; the API may change, so the committed raw snapshot remains
the source for this edition. The article itself is edited separately, not silently regenerated.

The retained chain report contains every pool's ID, currencies, opening block, swap count,
integer turnover, first/last observed swap, and every successful query range/topic group/count.
Checks run on the retained result: API response hash, all 475 response records, unique 564-pool
census, 86,400-second interval, gap-free/nonoverlapping swap query coverage for every pool, 6,468
summed events, 524 zero-swap pools, 32 new pools, 13 new quiet pools, and the 17 selected API records.
No failed or truncated query is counted as an empty response. Reporting is worker evidence,
not independent certification.
