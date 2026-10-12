// Read-only reporting recipe. Invoke with an explicit public RPC or worker loopback relay.
// Keeps issue #1's closing block, derives its preceding 24 hours by timestamp, and scans every
// IMD-paired v4 pool. No wallet, signing or private configuration is used.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPublicClient, http, parseAbiItem, decodeEventLog, toEventSelector, pad, toHex, erc20Abi } from 'viem';
const rpcUrl = process.argv[2];
if (!rpcUrl) throw new Error('Usage: node scripts/report-issue.mjs <RPC URL>');
const root = new URL('../../', import.meta.url);
const cfg = JSON.parse(await fs.readFile(new URL('dist/imd-deployment.json', root), 'utf8'));
const close = 26175145n;
const client = createPublicClient({ transport: http(rpcUrl, { timeout: 30_000, retryCount: 2 }) });
if (await client.getChainId() !== cfg.chainId) throw new Error('Wrong chain');
const end = await client.getBlock({ blockNumber: close });
const startTime = end.timestamp - 86400n;
let lo = close - 9000n, hi = close;
while (lo < hi) { const mid = (lo + hi) / 2n; const b = await client.getBlock({ blockNumber: mid }); if (b.timestamp <= startTime) lo = mid + 1n; else hi = mid; }
const start = await client.getBlock({ blockNumber: lo });
const previous = await client.getBlock({ blockNumber: lo - 1n });
const initialize = parseAbiItem('event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)');
const swap = parseAbiItem('event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)');
const manager = cfg.network.uniswapV4.poolManager, pair = cfg.network.pairToken.address.toLowerCase();
const queries=[];
async function logs(from, to, topics) {
  try {
    const result = await client.request({ method:'eth_getLogs', params:[{address:manager,fromBlock:toHex(from),toBlock:toHex(to),topics}] });
    queries.push({from:Number(from),to:Number(to),topics,count:result.length}); return result;
  } catch(e) {
    if (from >= to) throw e;
    const middle=(from+to)/2n;
    return [...await logs(from,middle,topics),...await logs(middle+1n,to,topics)];
  }
}
const initTopic=toEventSelector(initialize), pairTopic=pad(pair);
const initLogs=[...await logs(0n,close,[initTopic,null,pairTopic]),...await logs(0n,close,[initTopic,null,null,pairTopic])];
const pools=new Map();
for(const l of initLogs){const a=decodeEventLog({abi:[initialize],data:l.data,topics:l.topics}).args;pools.set(a.id,{id:a.id,currency0:a.currency0.toLowerCase(),currency1:a.currency1.toLowerCase(),fee:a.fee,hooks:a.hooks,initialized:Number(BigInt(l.blockNumber)),swaps:0,imdVolume:0n,tokenVolume:0n,firstSwap:null,lastSwap:null});}
console.log(`window ${lo}..${close}; ${pools.size} IMD pairs`);
const ids=[...pools.keys()];const swapLogs=[];
// Topic-filtered batches avoid scanning unrelated v4 swaps and the relay's response cap.
for(let i=0;i<ids.length;i+=32){
 const group=ids.slice(i,i+32);
 for(let from=lo;from<=close;from+=1200n){const to=from+1199n<close?from+1199n:close;swapLogs.push(...await logs(from,to,[toEventSelector(swap),group]));}
 console.log(`scanned ${Math.min(i+32,ids.length)}/${ids.length} pools`);
}
swapLogs.sort((a,b)=>Number(BigInt(a.blockNumber)-BigInt(b.blockNumber))||Number(BigInt(a.logIndex)-BigInt(b.logIndex)));
const unique=new Set();
for(const l of swapLogs){const key=l.transactionHash+':'+l.logIndex;if(unique.has(key))throw new Error('Duplicate swap');unique.add(key);const a=decodeEventLog({abi:[swap],data:l.data,topics:l.topics}).args;const p=pools.get(a.id);const abs=x=>x<0n?-x:x;p.swaps++;p.imdVolume+=abs(p.currency0===pair?a.amount0:a.amount1);p.tokenVolume+=abs(p.currency0===pair?a.amount1:a.amount0);const point={block:Number(BigInt(l.blockNumber)),sqrtPriceX96:a.sqrtPriceX96,tick:a.tick,transactionHash:l.transactionHash};p.firstSwap??=point;p.lastSwap=point;}
const active=[...pools.values()].filter(p=>p.swaps>0).sort((a,b)=>a.imdVolume>b.imdVolume?-1:1);
for(const p of [...new Set([...active.slice(0,5),...[...pools.values()].filter(p=>p.initialized>=Number(lo))])]){
 const address=p.currency0===pair?p.currency1:p.currency0;
 if(address==='0x0000000000000000000000000000000000000000'){p.symbol=cfg.network.nativeCurrency.symbol;p.decimals=cfg.network.nativeCurrency.decimals;continue;}
 p.symbol=await client.readContract({address,abi:erc20Abi,functionName:'symbol',blockNumber:close});
 p.decimals=await client.readContract({address,abi:erc20Abi,functionName:'decimals',blockNumber:close});
}
const fetchedAt=new Date().toISOString(),endpoint='https://api.imd.fun/launches?limit=500';
const response=await fetch(endpoint);if(!response.ok)throw new Error(`API HTTP ${response.status}`);const raw=await response.text();const api=JSON.parse(raw);
await fs.writeFile(new URL('docs/evidence/issue-1-api-snapshot.json',root),raw);
const matching=api.launches.filter(x=>x.chainId===1&&x.artifacts.some(a=>a.role==='token'&&a.blockNumber>=Number(lo)&&a.blockNumber<=Number(close)));
const report={generatedAt:new Date().toISOString(),chainId:1,window:{afterTimestamp:Number(startTime),throughTimestamp:Number(end.timestamp),fromBlock:Number(lo),toBlock:Number(close),firstBlockHash:start.hash,closingHash:end.hash,previousBlockTimestamp:Number(previous.timestamp)},api:{endpoint,fetchedAt,httpDate:response.headers.get('date'),bodySha256:createHash('sha256').update(raw).digest('hex'),count:api.count,returned:api.launches.length,windowLaunches:matching},method:'Quiet = zero PoolManager Swap events during (closing timestamp - 86400, closing timestamp], among every pool initialized with IMD as either currency by the closing block. API launch records are filtered locally by Ethereum token deployment block; live API status is a later snapshot, not a historical status assertion. Volume = sum(abs(IMD leg)) once per swap; no USD or fee double-counting.',poolCount:pools.size,activePools:active.length,quietPools:pools.size-active.length,totalSwaps:swapLogs.length,newPools:[...pools.values()].filter(p=>p.initialized>=Number(lo)).map(p=>p.id),pools:[...pools.values()],queries};
await fs.writeFile(new URL('docs/evidence/issue-1-chain-report.json',root),JSON.stringify(report,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n');
console.log(JSON.stringify({window:report.window,pools:report.poolCount,quiet:report.quietPools,active:report.activePools,swaps:report.totalSwaps,top:active.slice(0,5)},(_,v)=>typeof v==='bigint'?v.toString():v,2));
