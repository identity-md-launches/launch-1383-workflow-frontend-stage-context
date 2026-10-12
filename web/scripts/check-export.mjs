// Independently check the final export against the pinned handoff and source commit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { keccak256, toHex } from 'viem';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const h=read('.imd/reads/deployment.json'),n=read('.imd/reads/network.json'),m=read('dist/imd-deployment.json');
const canon=v=>Array.isArray(v)?'['+v.map(canon).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}':JSON.stringify(v);
assert.deepEqual(Object.keys(m).sort(),['version','launchId','chainId','sourceCommit','attestationHash','contracts','assets','poolKey','network','walletAddChain'].sort());
for(const k of ['version','launchId','chainId','sourceCommit','attestationHash','poolKey'])assert.deepEqual(m[k],h[k],k);
assert.deepEqual(m.network,n.network);assert.deepEqual(m.walletAddChain,n.walletAddChain);
assert.deepEqual(m.contracts.map(({name,address,abiHash})=>({name,address,abiHash})),h.contracts.map(({name,address,abiHash})=>({name,address,abiHash})));
const safe=p=>assert(typeof p==='string'&&p.length>0&&!p.startsWith('/')&&!p.includes('\\')&&!p.includes(':')&&!p.split('/').some(s=>s==='..'||s==='.'||s===''),'unsafe path '+p);
for(const c of m.contracts){
 safe(c.abiPath);const bytes=fs.readFileSync(new URL('dist/'+c.abiPath,root));const abi=JSON.parse(bytes);assert(Array.isArray(abi));assert.equal(keccak256(toHex(canon(abi))).slice(2),c.abiHash);
 const pinned=execFileSync('git',['show',`${h.sourceCommit}:docs/abi/${c.name}.json`],{cwd:root});assert.equal(canon(JSON.parse(pinned)),canon(abi),'pinned ABI differs');
 assert(bytes.equals(fs.readFileSync(new URL(`web/public/abi/${c.name}.json`,root))));
}
const dist=new URL('dist/',root).pathname;
function walk(dir,base=''){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{assert(!e.isSymbolicLink());const rel=base+e.name;return e.isDirectory()?walk(path.join(dir,e.name),rel+'/'):[rel]});}
const paths=walk(dist).filter(p=>p!=='imd-deployment.json').sort();assert.deepEqual(m.assets.map(a=>a.path).sort(),paths);assert(m.assets.length<=128);assert(paths.includes('index.html'));
let bytes=0;for(const a of m.assets){safe(a.path);assert(/^[a-f0-9]{64}$/.test(a.sha256));const b=fs.readFileSync(path.join(dist,a.path));assert(b.length<=8388608);bytes+=b.length;assert.equal(createHash('sha256').update(b).digest('hex'),a.sha256,a.path)}
assert(bytes<32*1024*1024);assert(fs.readFileSync(path.join(dist,'index.html'),'utf8').includes('./assets/'));
console.log(`Verified ${m.contracts.length} pinned ABIs, exact handoff/network/pool key, and all ${m.assets.length} assets (${bytes} bytes).`);
