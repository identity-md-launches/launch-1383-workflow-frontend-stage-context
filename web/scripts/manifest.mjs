// Generates dist/imd-deployment.json from the deployment handoff and the final export.
// Usage: node scripts/manifest.mjs [--handoff ../.imd/reads/deployment.json] [--network ../.imd/reads/network.json] [--dist ../dist]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { keccak256, toHex } from 'viem';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const here = path.dirname(new URL(import.meta.url).pathname);
const handoffPath = path.resolve(here, opt('--handoff', '../../.imd/reads/deployment.json'));
const networkPath = path.resolve(here, opt('--network', '../../.imd/reads/network.json'));
const dist = path.resolve(here, opt('--dist', '../../dist'));
const abiDir = path.resolve(here, opt('--abi', '../../docs/abi'));

const canon = (v) => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'
  : JSON.stringify(v);

const handoff = JSON.parse(fs.readFileSync(handoffPath, 'utf8'));
const network = fs.existsSync(networkPath) ? JSON.parse(fs.readFileSync(networkPath, 'utf8')) : null;

const contracts = handoff.contracts.map((c) => {
  const abiPath = `abi/${c.name}.json`;
  const src = path.join(abiDir, `${c.name}.json`);
  const raw = fs.readFileSync(src, 'utf8');
  const hash = keccak256(toHex(canon(JSON.parse(raw)))).slice(2);
  if (hash !== c.abiHash) throw new Error(`ABI hash mismatch for ${c.name}: ${hash} != ${c.abiHash}`);
  fs.mkdirSync(path.join(dist, 'abi'), { recursive: true });
  fs.writeFileSync(path.join(dist, abiPath), raw);
  return { name: c.name, address: c.address, abiHash: c.abiHash, abiPath };
});

const walk = (dir, base = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const rel = base ? `${base}/${e.name}` : e.name;
  return e.isDirectory() ? walk(path.join(dir, e.name), rel) : [rel];
});
const files = walk(dist).filter((f) => f !== 'imd-deployment.json').sort();
const assets = files.map((p) => {
  const buf = fs.readFileSync(path.join(dist, p));
  if (buf.length > 8 * 1024 * 1024) throw new Error(`${p} exceeds 8 MiB`);
  return { path: p, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
});
if (assets.length > 128) throw new Error(`${assets.length} assets exceed the 128 limit`);
if (!assets.some((a) => a.path === 'index.html')) throw new Error('index.html missing from dist');

const manifest = {
  version: 1,
  launchId: handoff.launchId,
  chainId: handoff.chainId,
  sourceCommit: handoff.sourceCommit,
  attestationHash: handoff.attestationHash,
  contracts,
  assets,
};
if (handoff.poolKey) {
  const { currency0, currency1, fee, tickSpacing, hooks } = handoff.poolKey;
  manifest.poolKey = { currency0, currency1, fee, tickSpacing, hooks };
}
if (network) {
  manifest.network = network.network;
  if (network.walletAddChain) manifest.walletAddChain = network.walletAddChain;
}
fs.writeFileSync(path.join(dist, 'imd-deployment.json'), JSON.stringify(manifest, null, 2) + '\n');
const total = assets.reduce((n, a) => n + fs.statSync(path.join(dist, a.path)).size, 0);
console.log(`wrote dist/imd-deployment.json: ${assets.length} assets, ${(total / 1024).toFixed(0)} KiB`);
