// Offline arithmetic/provenance checks for the edition's committed evidence, not a new RPC scan.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const article = read('web/public/issues/2026-10-12.json');
const chain = read('docs/evidence/issue-1-chain-report.json');
const snapshot = read('docs/evidence/issue-1-public-snapshot.json');
const apiBytes = fs.readFileSync(new URL('docs/evidence/issue-1-api-snapshot.json', root));
const api = JSON.parse(apiBytes);
assert.equal(createHash('sha256').update(apiBytes).digest('hex'), chain.api.bodySha256);
assert.equal(article.number, 1);
assert.equal(article.date, '2026-10-12');
const after = Date.parse(article.reporting.after), through = Date.parse(article.reporting.through);
assert.equal(through - after, 86_400_000);
assert.equal(chain.window.afterTimestamp * 1000, after);
assert.equal(chain.window.throughTimestamp * 1000, through);
assert.equal(chain.window.previousBlockTimestamp * 1000, after);
assert.equal(article.reporting.closingHash, chain.window.closingHash);
assert.equal(article.reporting.fromBlock, chain.window.fromBlock);
assert.equal(article.reporting.toBlock, chain.window.toBlock);
assert.equal(Date.parse(snapshot.window.after), after);
assert.equal(Date.parse(snapshot.window.through), through);
assert.equal(api.count, api.launches.length);
assert(api.count < 500, 'Launch snapshot needs another page');
const launches = api.launches.filter(l => l.chainId === 1 && l.artifacts.some(a =>
  a.role === 'token' && a.blockNumber >= chain.window.fromBlock && a.blockNumber <= chain.window.toBlock));
assert.deepEqual(launches, chain.api.windowLaunches);
assert.equal(new Set(chain.pools.map(p => p.id)).size, chain.poolCount);
assert.equal(chain.pools.length, chain.poolCount);
const swaps = chain.pools.reduce((n, p) => n + p.swaps, 0);
const quiet = chain.pools.filter(p => p.swaps === 0).length;
const turnover = chain.pools.reduce((n, p) => n + BigInt(p.imdVolume), 0n);
assert.equal(swaps, chain.totalSwaps);
assert.equal(quiet, chain.quietPools);
assert.equal(chain.poolCount - quiet, chain.activePools);
const queries = chain.queries.filter(q => Array.isArray(q.topics[1]));
assert.equal(queries.reduce((n, q) => n + q.count, 0), swaps);
for (const pool of chain.pools) {
  let next = chain.window.fromBlock;
  for (const q of queries.filter(q => q.topics[1].includes(pool.id)).sort((a, b) => a.from - b.from)) {
    assert.equal(q.from, next, 'Gap or overlap for ' + pool.id);
    next = q.to + 1;
  }
  assert.equal(next, chain.window.toBlock + 1);
}
assert.equal(new Set(snapshot.jobs.map(j => j.id)).size, snapshot.jobs.length);
assert(snapshot.jobs.every(j => after < Date.parse(j.createdAt) && Date.parse(j.createdAt) <= through));
assert.equal(snapshot.totals.newJobs, snapshot.jobs.length);
const jobsSources = snapshot.sources.filter(s => new URL(s.endpoint).pathname === '/jobs');
assert(Date.parse(jobsSources.at(-1).oldestCreatedAt) <= after, 'Job pagination did not reach window start');
assert.equal(new Set(snapshot.tokenCatalog.map(t => t.id)).size, snapshot.tokenCatalog.length);
assert.equal(snapshot.tokenCatalog.length, snapshot.sources.find(s => s.endpoint.includes('publications?')).count);
const catalog = new Map(snapshot.tokenCatalog.flatMap(p => p.contracts.map(c => [c.id, c])));
for (const launch of launches) {
  const token = launch.artifacts.find(a => a.role === 'token');
  const published = catalog.get(launch.id);
  assert(published, 'Window launch absent from token catalog');
  assert.equal(published.artifacts.find(a => a.role === 'token').address.toLowerCase(), token.address.toLowerCase());
}
for (const [number, symbol] of [[1376, 'SCOOP'], [1372, 'OFFSETS'], [1370, 'OFFSETS'], [1283, 'MARG']]) {
  assert.equal(catalog.get(launches.find(l => l.launchNumber === number).id).token.symbol, symbol);
}
assert.equal(snapshot.agentRecords.length, snapshot.sources.find(s => s.endpoint.endsWith('/seats/records')).returned);
assert(snapshot.explorer.some(s => s.endpoint.includes('/api/agents/')));
assert(snapshot.explorer.some(s => s.endpoint.includes('/api/search?')));
const items = article.sections.flatMap(s => s.items);
assert(items.some(i => i.figure === `${quiet} of ${chain.poolCount}`));
assert(items.some(i => i.figure === `${swaps.toLocaleString('en-US')} swaps`));
assert(items.some(i => i.figure === `${launches.length} deployments`));
assert(items.some(i => i.figure === `${snapshot.jobs.length} jobs`));
assert(!/issue #2|not reachable|placeholder|to be confirmed/i.test(JSON.stringify(article)));
console.log(JSON.stringify({ window: snapshot.window, pools: chain.poolCount, quiet, swaps,
  imdTurnoverWei: turnover.toString(), tokenDeployments: launches.length, newJobs: snapshot.jobs.length,
  tokenCatalogProjects: snapshot.tokenCatalog.length, agentDirectoryRecords: snapshot.agentRecords.length,
  swapQueries: queries.length, publicSources: snapshot.sources.length, dailyAgentMetric: 'omitted' }, null, 2));
