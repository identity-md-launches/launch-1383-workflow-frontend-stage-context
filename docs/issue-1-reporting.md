# Issue #1 reporting record

Edition: **2026-10-12, issue 1**. The original closing block is retained. The reporting window is
**(2026-10-11 08:18:35 UTC, 2026-10-12 08:18:35 UTC]**, inclusive Ethereum blocks
**26,167,966–26,175,145**. A binary search on block timestamps determines the first included block;
26,167,965 is exactly at the excluded opening timestamp. The closing block hash is
`0x753e77cf224709bc9b7e8ca98e0267146c8befd99ca810edf3558be8a750d27e`.

## Snapshot and historical data

All endpoint URLs, request/receipt timestamps, validation outcomes and limitations are recorded
in [validation.md](validation.md). The public snapshots are later than the window. They identify
projects and historical creation/deployment timestamps; current status is never substituted for
historical completion or activity.

- `GET https://api.imd.fun/launches?limit=500`: captured **2026-10-12T10:00:49.495Z**. The raw
  response contains 476 rows (less than the 500-page limit); 17 Ethereum token deployment block
  numbers fall in the window. Raw bytes and SHA-256 are retained.
- `GET https://api.imd.fun/jobs?limit=500&before=2026-10-12T08%3A18%3A35.001Z`: captured
  **10:09:03 UTC**. The exclusive cursor includes a creation exactly at the closing second.
  The page reaches before the opening and contains **327** jobs in (after, through]. All templates,
  including oracle panels, are included. Count job IDs, not completions or customers.
- `GET https://api.imd.fun/publications?type=tokens&pageSize=100&page=1` through page 4: captured
  **10:09:12–10:09:31 UTC**. All 328 unique published projects read; token name/symbol, launch ID,
  chain and artifact address corroborate **all 17** window launches. The lifetime catalog size is
  not a daily metric. This also distinguishes the two OFFSETS tokens (#1370 and #1372).
- `GET https://api.imd.fun/seats/records`, plus explorer `/api/agents/912`, `/api/activity` and
  `/api/search?q=SCOOP&part=published`: captured **10:09:03–10:09:32 UTC**. Used as current identity
  and publication snapshots only. Daily agent and acceptance totals are omitted: the directory
  lacks a historical activity series, and job-history requests repeatedly returned HTTP 503 busy.
  No partial cohort, lifetime total or invented figure replaces them.
- Ethereum logs: worker relay **http://127.0.0.1:39905/rpc/1**; chain ID checked as 1. Rerun finished
  **2026-10-12T10:00:49.558Z**. The runtime deployment manifest supplies PoolManager and IMD
  addresses. The hosted app never uses this worker-only endpoint.

## Definitions and results

1. Census every `Initialize` for the configured v4 PoolManager through the close, with IMD in
   either indexed currency position; deduplicate pool IDs. **564** pools, every hook and fee tier.
2. Query `Swap` for all those pool IDs over the complete window: 32 IDs per group and at most
   1,200 blocks per query, splitting further on range failures. There are **108 successful swap
   queries**, covering each pool without gaps or overlaps. Reject duplicate transaction/log IDs.
3. **Quiet = no Swap event in the window**: **524 quiet / 40 active**, including 13 quiet pools
   first initialized inside the window. Quiet is not a claim of abandonment or project quality.
4. **6,468 swaps**, **357,783.843549168552202752 IMD** gross turnover, calculated as
   `sum(abs(IMD leg))` once per event. Multiple pool legs of a routed trade remain separate events.
   This is neither USD volume nor unique traders, and the other currency is not added a second time.
5. **32 pools opened** in the window. The API's **17 Ethereum token deployments** are a narrower
   catalog measure; **15** of those token addresses match the pool census. Pools are not tokens.
6. “Biggest movers” is explicitly a **pool turnover ranking**, not price returns. Top individual
   pool: native ETH/IMD, 1% fee, **160,430.923994243731648215 IMD / 1,610 swaps**. Largest non-native
   token pool: INFER, **86,941.689434702296287416 IMD / 987 swaps**; next non-native token: MARG,
   **36,331.416839288153537896 IMD / 1,138 swaps**. Symbols and decimals were read at the close.
7. SCOOP pool: **6 swaps**, **15,480,115.432995101497460247 SCOOP**, **40.126538509024635471 IMD**.
   Last swap `sqrtPriceX96` gives about **0.000002606 IMD/SCOOP**. Article amounts round to two
   decimal places. TWATCH's pool opened at block 26,170,768 and had no swaps in the interval.

## Retained evidence and reproduction

- `docs/evidence/issue-1-api-snapshot.json`: complete raw launch response.
- `docs/evidence/issue-1-chain-report.json`: timestamp boundaries/hashes, per-pool integer results,
  first/last swaps and successful query coverage.
- `docs/evidence/issue-1-public-snapshot.json`: selected job/token/agent/explorer fields, exact
  endpoints, request and receipt times, HTTP Date and raw-response SHA-256. Large unrelated
  descriptions are intentionally not retained; the projections are not the original raw bytes.

From `web/` with the unchanged lockfile dependencies installed:

```sh
node scripts/report-issue.mjs http://127.0.0.1:39905/rpc/1
python3 scripts/snapshot-issue.py
node scripts/check-report.mjs
```

Supply an accessible Ethereum archive RPC explicitly on another machine. Both reporting recipes
make public read requests only, require no wallet, and do not write article text automatically.
They refresh evidence; do not overwrite the edition's committed snapshots just to recompute its
arithmetic. `check-report.mjs` is the offline check of those retained snapshots, including digest,
window, per-pool coverage, unique IDs, counts, token-catalog matches and the article's figures.
A later snapshot may contain additional publications; that is not evidence of more historical work.
