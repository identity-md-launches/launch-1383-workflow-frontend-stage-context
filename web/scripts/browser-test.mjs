// Production-export interaction tests. RPC and EIP-1193 responses are deterministic fixtures;
// the harness never forwards signing requests or connects to a real wallet.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { decodeFunctionData, encodeFunctionResult, parseEther, zeroAddress, multicall3Abi } from 'viem';
import { ERC20_ABI, PERMIT2_ABI, QUOTER_ABI, STATE_VIEW_ABI, UNIVERSAL_ROUTER_ABI } from '../src/lib/swap.ts';
const root=fileURLToPath(new URL('../../',import.meta.url));
const dist=path.join(root,'dist');
const baseline=process.argv.includes('--reproduce');
const evidence=path.join(root,'docs/evidence');
const frontAbi=JSON.parse(await fs.readFile(path.join(dist,'abi/ScoopFrontPage.json'),'utf8'));
const cfg=JSON.parse(await fs.readFile(path.join(dist,'imd-deployment.json'),'utf8'));
const account='0x1111111111111111111111111111111111111111'; // Fixture only, never runtime config.
const today=Math.floor(Date.now()/86400000);
const findings=[];
const consoleErrors=[],resourceFailures=[];
const server=createServer(async(req,res)=>{
 try{const rel=decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\/preview\//,'');const file=path.resolve(dist,rel);if(!file.startsWith(dist+'/'))throw Error('path');const data=await fs.readFile(file);const ext=path.extname(file);res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.woff2':'font/woff2'})[ext]??'application/octet-stream');res.end(data)}catch{res.writeHead(404);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/preview/index.html`;
const browser=await chromium.launch({executablePath:process.env.SCOOP_CHROMIUM||undefined,args:['--no-sandbox']});
function record(name,value){findings.push({name,...value});console.log(name,JSON.stringify(value));}
async function until(fn, message, timeout=8000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,50));}throw Error(message);}
async function setup(width,{wallet=false,chain='0x1',failure=false,bookings=[],slotFailure=false,delay=0,slotDelay=0,named=false,unknown=false,providerMissing=false,clientDelay=0}={}){
 const context=await browser.newContext({viewport:{width,height:width<600?844:900},reducedMotion:'reduce'});
 if(wallet)await context.addInitScript(({account,chain,named,unknown,providerMissing,clientDelay})=>{
  const listeners={};let connected=false,missing=unknown;
  const p={
   on:(e,fn)=>{(listeners[e]??=new Set()).add(fn)},removeListener:(e,fn)=>listeners[e]?.delete(fn),
   request:async({method,params})=>{
    if(method==='eth_chainId'){if(window.__delayClient)await new Promise(r=>setTimeout(r,clientDelay));return chain;}
    if(method==='eth_accounts')return connected?[account]:[];
    if(method==='eth_requestAccounts'){if(providerMissing)throw new Error('Provider not found. Version: fixture');connected=true;return [account]}
    if(method==='wallet_switchEthereumChain'){if(missing){const e=new Error('Unknown chain');e.code=4902;throw e}chain=params[0].chainId;for(const fn of listeners.chainChanged??[])fn(chain);return null}
    if(method==='wallet_addEthereumChain'){window.__addChain=params[0];missing=false;return null}
    if(method==='eth_sendTransaction'){window.__sent=(window.__sent??0)+1;const e=new Error('User rejected the request');e.code=4001;throw e}
    if(method==='wallet_requestPermissions')return [{parentCapability:'eth_accounts'}];
    throw new Error('Unsupported fixture method '+method);
   }
  };
  window.ethereum=p;window.__setChain=c=>{chain=c;window.__delayClient=true;for(const fn of listeners.chainChanged??[])fn(c)};
  if(named){const announce=()=>window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{uuid:'350670db-19fa-4704-a166-e52e178b59d2',name:'Fixture Wallet',icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',rdns:'test.fixture'},provider:p}}));window.addEventListener('eip6963:requestProvider',announce);announce()}
 },{account,chain,named,unknown,providerMissing,clientDelay});
 const state={failure,bookings,slotFailure,delay,slotDelay,calls:[],smallQuote:false,allowanceReady:false,contractDay:today,windowDays:30};
 const errors=[];const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);consoleErrors.push('pageerror: '+e.message)});
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
 page.on('response',r=>{if(r.url().startsWith(url.split('/preview/')[0])&&r.status()>=400)resourceFailures.push({url:r.url(),status:r.status()})});
 await page.route('https://**',async route=>{
  const payload=route.request().postDataJSON();
  assert(!Array.isArray(payload)||payload.length<=3,'JSON-RPC batch exceeds 3');
  if(state.slotDelay && (Array.isArray(payload)?payload:[payload]).some(q=>{try{return decodeFunctionData({abi:[...frontAbi,...multicall3Abi],data:q.params?.[0]?.data}).functionName.match(/slotOf|aggregate3/)}catch{return false}}))await new Promise(r=>setTimeout(r,state.slotDelay));
  if(state.delay)await new Promise(r=>setTimeout(r,state.delay));
  function reply(q){
   try{
    if(state.failure)throw Error('Review fixture: RPC unavailable');
    if(q.method==='eth_chainId')return {jsonrpc:'2.0',id:q.id,result:'0x1'};
    if(q.method==='eth_blockNumber')return {jsonrpc:'2.0',id:q.id,result:'0x18f6a00'};
    if(q.method==='eth_getCode')return {jsonrpc:'2.0',id:q.id,result:'0x60006000'};
    if(q.method!=='eth_call')throw Error('Unexpected RPC method '+q.method);
    let decoded,abi;
    const all=[frontAbi,ERC20_ABI,QUOTER_ABI,STATE_VIEW_ABI,PERMIT2_ABI,UNIVERSAL_ROUTER_ABI,multicall3Abi];
    for(const a of all){try{decoded=decodeFunctionData({abi:a,data:q.params[0].data});abi=a;break}catch{}}
    if(!decoded)throw Error('Unknown selector '+q.params[0].data.slice(0,10));
    const {functionName:name,args}=decoded;state.calls.push(name);
    if(name==='aggregate3') {
      const result=args[0].map(c=>{const r=reply({id:0,method:'eth_call',params:[{to:c.target,data:c.callData},'latest']});return {success:!r.error,returnData:r.result??'0x'}});
      return {jsonrpc:'2.0',id:q.id,result:encodeFunctionResult({abi:multicall3Abi,functionName:'aggregate3',result})};
    }
    if(name==='slotOf'&&state.slotFailure)throw Error('Review fixture: slot unavailable');
    const slot={buyer:account,token:cfg.contracts[0].address,paid:parseEther('2000000'),burned:false,headline:'Fixture booking',link:'https://example.org/sponsor/path?q=1'};
    const results={balanceOf:10n**30n,allowance:args?.length===3?[state.allowanceReady?10n**30n:0n,BigInt(Math.floor(Date.now()/1000)+86400),0]:state.allowanceReady?10n**30n:0n,totalSupply:parseEther('1000000000'),decimals:18,symbol:'SCOOP',price:parseEther('2000000'),nextPrice:[parseEther('2000000'),0n],currentDay:BigInt(state.contractDay),bookingWindow:[BigInt(state.contractDay+1),BigInt(state.contractDay+state.windowDays)],owner:'0x2222222222222222222222222222222222222222',pendingOwner:zeroAddress,bookedDays:state.bookings.map(BigInt),slotOf:state.bookings.includes(Number(args?.[0]))?slot:{...slot,buyer:zeroAddress,paid:0n,headline:''},getSlot0:[BigInt(Math.floor(2**96/Math.sqrt(354200))),0,0,12500],getLiquidity:10n**24n,quoteExactInputSingle:[parseEther(state.smallQuote?'0.000002606':'100'),100000n],execute:undefined};
    if(name==='execute')state.executeArgs=args;
    if(!(name in results))throw Error('No fixture result '+name);
    return {jsonrpc:'2.0',id:q.id,result:encodeFunctionResult({abi,functionName:name,result:results[name]})};
   }catch(e){return {jsonrpc:'2.0',id:q.id,error:{code:-32000,message:e.message}}}
  }
  await route.fulfill({json:Array.isArray(payload)?payload.map(reply):reply(payload)});
 });
 return {context,page,state,errors};
}
async function connect(page){await page.getByRole('button',{name:'Connect wallet'}).first().click();await until(()=>page.getByRole('button',{name:'Disconnect',exact:true}).count(),'connection failed');}
try{
 for(const width of [390,500,1440]){
  {
   const {context,page,errors}=await setup(width);
   await page.goto(url+'#/trade');await page.locator('#amount').fill('1000000');await until(()=>page.getByText('≈ 100 SCOOP',{exact:true}).count(),'quote missing');
   await page.evaluate(()=>window.scrollTo(0,0));
   const view=await page.evaluate(()=>({og:document.querySelector('meta[property="og:image"]')?.content??null,inputY:document.querySelector('#amount').getBoundingClientRect().y,swapBottom:document.querySelector('.trade-card > .btn--accent').getBoundingClientRect().bottom,cardY:document.querySelector('.trade-card').getBoundingClientRect().y,detailsY:document.querySelector('.trade-details').getBoundingClientRect().y,cardX:document.querySelector('.trade-card').getBoundingClientRect().x,detailsX:document.querySelector('.trade-details').getBoundingClientRect().x,connectors:[...document.querySelectorAll('.walletbar button')].map(x=>x.textContent),overflow:document.documentElement.scrollWidth>innerWidth}));
   record(`layout ${width}`,view);
   if(!baseline){assert(view.og);assert(view.inputY<(width<600?844:900));if(width<768){assert(view.inputY<844,'Trade input below first screen');if(width===390)assert(view.swapBottom<=844,'Swap below first screen');assert(view.cardY<view.detailsY);}else{assert(view.cardX>view.detailsX);}assert(!view.overflow);assert.equal(view.connectors.length,0);assert.match(await page.locator('.walletbar').innerText(),/No wallet found\. Open this site in a wallet browser or install a browser wallet\./);assert.equal(view.og,'https://scoop.sites.imd.fun/share-card.png');assert.equal(await page.locator('meta[name="twitter:card"]').getAttribute('content'),'summary_large_image');const asset=await page.request.get(new URL('./share-card.png',url).href);assert(asset.ok());assert.equal(asset.headers()['content-type'],'image/png');}
   else {await page.getByRole('button',{name:'Connect Injected'}).click();await until(()=>page.getByRole('alert').count(),'no provider error missing');record(`no wallet ${width}`,{error:await page.getByRole('alert').innerText()});}
   await page.locator('.skip').focus();await page.keyboard.press('Enter');await page.waitForTimeout(100);
   const skipped=await page.evaluate(()=>({hash:location.hash,amount:document.querySelector('#amount')?.value??null,focus:document.activeElement.id}));record(`skip trade ${width}`,skipped);
   if(!baseline){assert.equal(skipped.hash,'#/trade');assert.equal(skipped.amount,'1000000');assert.equal(skipped.focus,'main');await page.getByRole('button',{name:'Sell SCOOP',exact:true}).click();await until(()=>page.getByText('≈ 100 IMD',{exact:true}).count(),'sell quote missing');assert.equal(await page.locator('#amount').inputValue(),'1000000');await page.getByRole('button',{name:'Buy SCOOP',exact:true}).click();await until(()=>page.getByText('≈ 100 SCOOP',{exact:true}).count(),'buy quote missing');}
   if(!baseline){for(const route of ['book','archive']){await page.goto(url+'#/'+route);if(route==='book'){await page.locator('#headline').fill('Keep this headline');await page.locator('#token').fill(cfg.contracts[0].address);await page.locator('#link').fill('https://example.org/sponsor');await until(()=>page.locator('.day:enabled').count(),'calendar did not load');await page.locator('.day:enabled').first().click();}await page.locator('.skip').focus();await page.keyboard.press('Enter');assert.equal(new URL(page.url()).hash,'#/'+route);assert.equal(await page.evaluate(()=>document.activeElement.id),'main');if(route==='book'){assert.equal(await page.locator('#headline').inputValue(),'Keep this headline');assert.equal(await page.locator('#token').inputValue(),cfg.contracts[0].address);assert.equal(await page.locator('#link').inputValue(),'https://example.org/sponsor');assert.equal(await page.locator('.day[aria-pressed=true]').count(),1);}}}
   assert.deepEqual(errors,[]);await context.close();
  }
  {
   const {context,page,state}=await setup(width,{wallet:true,chain:'0xa'});await page.goto(url+'#/trade');await connect(page);
   assert.match(await page.locator('.walletbar').innerText(),/Wrong network/i);
   await page.getByRole('button',{name:'Switch to Ethereum'}).click();await page.waitForTimeout(baseline?1000:500);
   record(`switch into Ethereum ${width}`,{status:await page.locator('.walletbar').innerText()});
   if(!baseline)await until(async()=>!await page.getByRole('button',{name:'Switch to Ethereum'}).count(),'switch did not unlock');
   // Remount reproduces the stale-client variant independently of the initial switch.
   if(baseline){await page.goto(url+'#/book');await page.goto(url+'#/trade');}
   await page.locator('#amount').fill('1');await until(()=>page.getByText('≈ 100 SCOOP',{exact:true}).count(),'quote missing');
   const swap=page.getByRole('button',{name:'Swap IMD for SCOOP',exact:true});
   if(!baseline)await until(()=>swap.isEnabled(),'valid swap did not unlock');
   await page.locator('#slippage').fill('100');
   record(`slippage 100 ${width}`,{enabled:await swap.isEnabled(),minimum:await page.locator('dt').filter({hasText:/^Minimum$/}).locator('xpath=following-sibling::dd[1]').innerText()});
   if(baseline){if(await swap.isEnabled()){await swap.click();await page.waitForTimeout(150);record(`invalid plan ${width}`,{steps:await page.locator('.steps').innerText()});}}
   else {
    for(const value of ['100','-1','','51','1e309','-0.01','50.0001']){await page.locator('#slippage').fill(value);assert(await swap.isDisabled());assert.equal(await page.locator('#slippage').getAttribute('aria-invalid'),'true');assert(await page.getByText('Enter slippage between 0 and 50%.',{exact:true}).count());
     // Bypass the HTML disabled property; the React handler must still reject invalid values.
     await swap.evaluate(el=>{el.disabled=false;el.click();el.disabled=true});await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>window.__sent??0),0);assert.equal(await page.locator('.steps li').count(),0);
    }
    for(const value of ['0','50','1','0.01','49.99']){await page.locator('#slippage').fill(value);await until(()=>swap.isEnabled(),'valid slippage rejected');}
   }
   await page.evaluate(()=>window.__setChain('0xa'));await page.waitForTimeout(150);record(`switch away ${width}`,{status:await page.locator('.walletbar').innerText(),swapEnabled:await swap.isEnabled()});
   if(!baseline){assert.match(await page.locator('.walletbar').innerText(),/Wrong network/i);assert(await swap.isDisabled());await page.getByRole('button',{name:'Switch to Ethereum'}).click();await until(()=>swap.isEnabled(),'switch back did not unlock');await swap.click();await until(()=>page.getByText('You rejected the request in your wallet.',{exact:true}).count(),'rejection message missing');assert.equal(await page.evaluate(()=>window.__sent),1);assert(state.calls.includes('allowance'));assert(await swap.isEnabled(),'swap did not recover after rejection');}
   await context.close();
  }
  {
   const {context,page,state}=await setup(width,{wallet:true,failure:true});await page.goto(url+'#/book');await connect(page);await until(async()=>/Could not reach Ethereum/.test(await page.locator('.legend').first().innerText()),'error not displayed',20000);
   record(`failed bookings ${width}`,{enabled:await page.locator('.day:enabled').count(),ledger:await page.locator('#burn-h').locator('..').innerText(),mine:await page.locator('#mine-h').locator('..').innerText()});
   if(!baseline){assert.equal(await page.locator('.day:enabled').count(),0);assert.equal(await page.getByText('No bookings in the window.',{exact:true}).count(),0);assert.match(await page.locator('#mine-h').locator('..').innerText(),/Could not reach Ethereum/);state.failure=false;state.bookings=[today+2];await page.getByRole('button',{name:'Retry bookings',exact:true}).first().click();await until(()=>page.getByText('Fixture booking',{exact:true}).count(),'retry did not recover');assert.equal(await page.locator('.day:enabled').count(),29);assert.equal(await page.locator('.day:disabled').count(),1);await page.goto(url+'#/trade');await page.goto(url+'#/book');await page.locator('#token').fill(cfg.contracts[0].address);await page.locator('#headline').fill('Keep this headline');await page.locator('.day:enabled').first().click();await page.evaluate(()=>window.__setChain('0xa'));await until(()=>page.getByRole('button',{name:'Switch to Ethereum'}).count(),'booking badge stale');assert(await page.getByRole('button',{name:/^Approve and book/}).isDisabled());await page.getByRole('button',{name:'Switch to Ethereum'}).click();await until(()=>page.getByRole('button',{name:/^Approve and book/}).isEnabled(),'booking switch did not unlock');await page.getByRole('button',{name:/^Approve and book/}).click();await until(()=>page.getByText('You rejected the request in your wallet.',{exact:true}).count(),'booking rejection message missing');assert.equal(await page.evaluate(()=>window.__sent),1);assert(await page.getByRole('button',{name:/^Approve and book/}).isEnabled(),'booking did not recover after rejection');}
   await context.close();
  }
 }
 if(!baseline){
  for(const mode of ['loading','slot-loading','slot-error','empty']){
   const {context,page,state}=await setup(390,{wallet:true,delay:mode==='loading'?1500:0,bookings:mode.startsWith('slot-')?[today+1]:[],slotFailure:mode==='slot-error',slotDelay:mode==='slot-loading'?1500:0});await page.goto(url+'#/book');await page.locator('.day').first().waitFor();
   if(mode==='loading'){assert.equal(await page.locator('.day:enabled').count(),0);assert.equal(await page.getByText('No bookings in the window.',{exact:true}).count(),0);}
   if(mode==='slot-loading'){await until(()=>state.calls.includes('bookedDays'),'days not read');assert.equal(await page.locator('.day:enabled').count(),0);await connect(page);assert.equal(await page.getByText(/No bookings from/).count(),0);await until(()=>page.locator('.day:enabled').count(),'slot loading did not recover');}
   if(mode==='slot-error'){await connect(page);await until(()=>page.getByText('Could not reach Ethereum right now. Try again.',{exact:true}).count(),'slot error not displayed',20000);assert.equal(await page.locator('.day:enabled').count(),0);assert(await page.getByRole('button',{name:/^Approve and book/}).isDisabled());await page.locator('.day').first().evaluate(el=>{el.disabled=false;el.click();el.disabled=true});assert.equal(await page.locator('.day[aria-pressed=true]').count(),0);assert.equal(await page.getByText('No bookings in the window.',{exact:true}).count(),0);assert.equal(await page.getByText(/No bookings from/).count(),0);state.slotFailure=false;await page.getByRole('button',{name:'Retry bookings'}).first().click();await until(()=>page.getByText('Fixture booking',{exact:true}).count(),'slot retry failed');}
   if(mode==='empty'){await until(()=>page.getByText('No bookings in the window.',{exact:true}).count(),'successful empty result missing');assert.equal(await page.locator('.day:enabled').count(),30);await connect(page);await until(()=>page.getByText(/No bookings from/).count(),'own successful empty result missing');}
   await context.close();record(mode,{passed:true});
  }
  {
   const {context,page}=await setup(390,{wallet:true,chain:'0xa',unknown:true,named:true});await page.goto(url+'#/trade');await page.getByRole('button',{name:'Connect wallet',exact:true}).first().waitFor();assert.equal(await page.getByRole('button',{name:'Connect wallet',exact:true}).count(),1,'same provider offered twice');assert(await page.getByText('Fixture Wallet',{exact:true}).count());await connect(page);await page.getByRole('button',{name:'Switch to Ethereum'}).click();await until(async()=>!await page.getByRole('button',{name:'Switch to Ethereum'}).count(),'add chain failed');assert.deepEqual(await page.evaluate(()=>window.__addChain),cfg.walletAddChain);await context.close();record('discovered wallet and unknown chain',{passed:true});
  }
  {
   const {context,page}=await setup(390,{wallet:true,providerMissing:true});await page.goto(url+'#/trade');await page.getByRole('button',{name:'Connect wallet',exact:true}).click();await until(()=>page.getByRole('alert').count(),'provider error missing');assert.equal(await page.getByRole('alert').innerText(),'No wallet found. Open this site in a wallet browser or install a browser wallet.');assert(!/Provider not found/.test(await page.locator('body').innerText()));await context.close();record('missing provider error sanitized',{passed:true});
  }
  for(const route of ['book','trade']){
   const {context,page}=await setup(390,{wallet:true,clientDelay:1200});await page.goto(url+'#/'+route);await connect(page);await until(()=>page.locator('.badge').filter({hasText:/^Ethereum$/}).count(),'initial badge missing');
   await page.evaluate(()=>window.__setChain('0xa'));await until(()=>page.getByText('Wrong network',{exact:true}).count(),'wrong badge delayed');
   await page.evaluate(()=>window.__setChain('0x1'));await until(()=>page.locator('.badge').filter({hasText:/^Ethereum$/}).count(),'Ethereum badge waits on wallet client',700);assert.equal(await page.getByText('Wrong network',{exact:true}).count(),0);await context.close();record('immediate network badge '+route,{passed:true});
  }
  {
   const {context,page}=await setup(390);await page.goto(url+'#/');await page.getByRole('navigation').getByRole('link',{name:'Archive',exact:true}).click();await page.locator('.archive-table a').click();await until(()=>page.getByRole('heading',{name:'SCOOP hits the stands: the swarm gets a daily',exact:true}).count(),'archive issue missing');assert.equal(new URL(page.url()).hash,'#/issue/2026-10-12');await page.getByRole('navigation').getByRole('link',{name:'Trade',exact:true}).click();await page.locator('#amount').waitFor();assert.equal(new URL(page.url()).hash,'#/trade');await context.close();record('hash navigation and archived issue',{passed:true});
  }
  // Requested regressions: at-press copy, precision/re-quotes, wallet links and bad data recovery.
  for(const width of [390,500,1440]){
   const {context,page,state}=await setup(width,{wallet:true});state.smallQuote=true;state.allowanceReady=true;
   await page.clock.install();await page.goto(url+'#/trade');await connect(page);await page.getByRole('button',{name:'Sell SCOOP',exact:true}).click();await page.locator('#amount').fill('1');
   await until(()=>page.getByText('≈ 0.000002606 IMD',{exact:true}).count(),'tiny quote rounded away');
   assert.equal(await page.locator('dt').filter({hasText:/^Minimum$/}).locator('xpath=following-sibling::dd[1]').innerText(),'0.000002579 IMD');
   await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(evidence,`trade-quote-${width}.png`)});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert(await page.getByText('354,200 SCOOP per IMD',{exact:true}).count());
   assert.equal(await page.getByText('USD',{exact:true}).count(),0);assert.equal(await page.getByText('Liquidity',{exact:true}).count(),0);
   const displayed=await page.locator('body').innerText();for(const address of [cfg.contracts[0].address,cfg.network.pairToken.address])assert.equal(displayed.split(address).length-1,1,'duplicate address');
   const count=()=>state.calls.filter(n=>n==='quoteExactInputSingle').length;
   const before=count();await page.clock.fastForward(20_100);await until(()=>count()>before,'20-second re-quote missing');await page.clock.resume();
   const beforeSwap=count();await page.getByRole('button',{name:'Swap SCOOP for IMD',exact:true}).click();await until(()=>page.getByText('You rejected the request in your wallet.',{exact:true}).count(),'swap simulation did not reach wallet');
   assert(count()>beforeSwap,'fresh quote before swap missing');assert(state.executeArgs,'router not simulated');assert(state.calls.lastIndexOf('quoteExactInputSingle')<state.calls.lastIndexOf('execute'));
   assert.equal(await page.evaluate(()=>window.__sent),1);record('tiny sell, grouped pool rate, 20s refresh and pre-swap quote '+width,{passed:true});await context.close();
  }
  for(const width of [390,500,1440]){
   const {context,page,state}=await setup(width);await page.goto(url+'#/book');await until(async()=>await page.locator('.wallet-links a').count()===3,'wallet links missing');
   assert.deepEqual(await page.locator('.wallet-links a').evaluateAll(links=>links.map(a=>a.href)),['https://metamask.app.link/dapp/scoop.sites.imd.fun','https://go.cb-w.com/dapp?cb_url=https%3A%2F%2Fscoop.sites.imd.fun','https://link.trustwallet.com/open_url?coin_id=60&url=https%3A%2F%2Fscoop.sites.imd.fun']);
   await page.locator('#token').fill(cfg.contracts[0].address);await page.locator('#headline').fill('A new headline in print');await page.locator('#link').fill('https://example.org/a/long/path?q=1');
   assert(await page.locator('.ad-preview').getByText('A new headline in print',{exact:true}).count());assert.equal(await page.locator('.ad-preview a').innerText(),'example.org');
   assert(await page.locator('.ad-preview').getByText('External link, not checked by SCOOP',{exact:true}).count());
   await page.locator('#link').fill('javascript:alert(1)');assert.equal(await page.locator('.ad-preview a').count(),0);
   assert(await page.getByRole('link',{name:'Get SCOOP'}).count());
   await page.goto(url+'#/');await until(()=>page.locator('.sponsored').innerText().then(t=>t.includes('SCOOP a day, next free day')),'house ad missing');assert.match(await page.locator('.sponsored').innerText(),/2,000,000 SCOOP a day, next free day/);
   state.bookings=[today];await page.reload();await until(()=>page.locator('.sponsored__symbol').textContent().then(t=>t==='SCOOP'),'sponsor symbol missing');assert.equal(await page.locator('.sponsored a').innerText(),'example.org');
   record('wallet links and ad preview '+width,{passed:true});await context.close();
  }
  {
   const {context,page,state}=await setup(390);state.contractDay=today+2;state.windowDays=7;await page.goto(url+'#/book');await until(async()=>await page.locator('.day:enabled').count()===7,'calendar ignored contract window');assert.match(await page.locator('.day').first().getAttribute('aria-label'),new RegExp(String(new Date((today+3)*86400000).getUTCDate())));record('contract calendar overrides the clock',{passed:true});await context.close();
  }
  {
   const {context,page}=await setup(390);await page.clock.setFixedTime(new Date('2026-10-13T00:00:00Z'));await page.goto(url+'#/');await until(()=>page.getByText("Today's issue is at the press. Here is the latest one.",{exact:true}).count(),'at-press message missing');assert.equal(await page.getByText(/No issue filed/).count(),0);await page.locator('#issue-headline').waitFor();assert((await page.locator('#issue-headline').boundingBox()).y<=420);record('midnight at-press front page',{passed:true});await context.close();
  }
  for(const target of ['index','issue']){
   const {context,page}=await setup(390);let invalid=true;
   const glob=target==='index'?'**/issues/index.json':'**/issues/2026-10-12.json';
   await page.route(glob,async route=>invalid?route.fulfill({json:target==='index'?[{date:'2026-10-12',number:1,headline:null}]:{date:'2026-10-12',number:1,headline:'Unsafe fixture',sections:null}}):route.continue());
   await page.goto(url+'#/');await until(()=>page.getByRole('button',{name:'Retry',exact:true}).count(),'invalid data did not offer recovery');assert.equal(await page.locator('#issue-headline').count(),0);assert(!/TypeError|Invalid issue|Unsafe fixture/.test(await page.locator('body').innerText()));
   invalid=false;await page.getByRole('button',{name:'Retry',exact:true}).first().click();await until(()=>page.locator('#issue-headline').count(),'issue retry failed');record('invalid '+target+' recovery',{passed:true});await context.close();
  }
  {
   const {context,page,state}=await setup(390);state.failure=true;await page.goto(url+'#/trade');await page.locator('#amount').fill('1');await until(()=>page.getByRole('button',{name:'Retry',exact:true}).count(),'RPC retry missing',20000);assert(!/Review fixture|viem|Version:|eth_call/.test(await page.locator('body').innerText()));state.failure=false;await page.getByRole('button',{name:'Retry',exact:true}).first().click();await until(()=>page.getByText('≈ 100 SCOOP',{exact:true}).count(),'quote retry failed');record('RPC error sanitization and retry',{passed:true});await context.close();
  }
  {
   const start=consoleErrors.length;const {context,page}=await setup(390);await page.addInitScript(()=>{if(!sessionStorage.getItem('restore-render'))Intl.NumberFormat=function(){throw new Error('Raw render fixture details must never appear')}});
   await page.goto(url+'#/trade');await until(()=>page.getByText('This page could not load. Try again.',{exact:true}).count(),'error boundary missing');assert(!/Raw render fixture/.test(await page.locator('body').innerText()));assert(await page.getByRole('button',{name:'Retry',exact:true}).count());
   const caught=consoleErrors.splice(start);assert(caught.some(m=>m.includes('Raw render fixture')));await page.evaluate(()=>sessionStorage.setItem('restore-render','yes'));await page.getByRole('button',{name:'Retry',exact:true}).click();await page.locator('#amount').waitFor();record('error boundary catches rendering failure and retries',{passed:true,expectedConsoleErrors:caught.length});await context.close();
  }
  {
   const {context,page}=await setup(390);const legacy=JSON.parse(await fs.readFile(path.join(dist,'issues/2026-10-12.json'),'utf8'));delete legacy.deck;delete legacy.body;
   await page.route('**/issues/2026-10-12.json',route=>route.fulfill({json:legacy}));await page.goto(url+'#/');await page.locator('#issue-headline').waitFor();assert.equal(await page.locator('.issue__body p').count(),1);assert.equal(await page.locator('.issue__deck').innerText(),legacy.standfirst);record('legacy issue without deck or body',{passed:true});await context.close();
  }
  {
   const {context,page}=await setup(390);let broken=true;await page.route('**/imd-deployment.json',route=>broken?route.fulfill({json:null}):route.continue());await page.goto(url+'#/');await page.getByRole('button',{name:'Retry',exact:true}).waitFor();assert.equal(await page.getByRole('alert').locator('p').innerText(),'This page could not load. Try again.');broken=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await page.locator('#issue-headline').waitFor();record('startup failure and retry',{passed:true});await context.close();
  }
  {
   const {context,page}=await setup(390,{wallet:true});await page.goto(url+'#/book');await connect(page);await until(()=>page.getByRole('button',{name:/^Approve and book/}).isEnabled(),'booking form not ready');await page.getByRole('button',{name:/^Approve and book/}).click();assert.equal(await page.locator('.day:enabled').first().evaluate(el=>el===document.activeElement),true);await page.locator('.day:enabled').first().click();await page.getByRole('button',{name:/^Approve and book/}).click();assert.equal(await page.evaluate(()=>document.activeElement.id),'token');assert.equal(await page.evaluate(()=>window.__sent??0),0);record('invalid booking focuses the first field without signing',{passed:true});await context.close();
  }
  await fs.mkdir(evidence,{recursive:true});
  for(const width of [320,390,500,1024,1440]){
   const {context,page,errors}=await setup(width);
   for(const route of ['','trade','book','archive','issue/2026-10-12']){await page.goto(url+'#/'+route);await page.locator('main h2').first().waitFor();await page.waitForTimeout(200);if(width===390&&route==='book'){await until(()=>page.locator('.day:enabled').count(),'calendar not ready');const first=await page.locator('.day:enabled').first().boundingBox();assert(first.y+first.height<=844,'calendar action below first screen');record('first book action 390',{bottom:first.y+first.height});}assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${route} ${width}`);
    const layout=await page.evaluate(()=>{const rect=s=>document.querySelector(s)?.getBoundingClientRect();const tops=[...document.querySelectorAll('.nav a')].map(a=>a.getBoundingClientRect().top);return {navRows:new Set(tops).size,mainOutline:getComputedStyle(document.querySelector('#main')).outlineStyle,wallets:document.querySelectorAll('.walletbar').length,headlineY:rect('#issue-headline')?.top,leadY:rect('.issue-lead')?.top,numbersY:rect('.swarm-rail')?.top,graphicY:rect('.ink-graphic')?.top,grid:document.querySelector('.newspaper')?getComputedStyle(document.querySelector('.newspaper')).gridTemplateColumns.split(' ').length:null,gutter:document.querySelector('.newspaper')?getComputedStyle(document.querySelector('.newspaper')).columnGap:null,fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family)}});
    assert.equal(layout.navRows,1);assert.equal(layout.mainOutline,'none');assert.equal(layout.wallets,['book','trade'].includes(route)?1:0);
    if(route===''&&width===390)assert(layout.headlineY<=420,'headline below 420px');
    if(route===''&&width<1024)assert(layout.leadY<layout.numbersY&&layout.numbersY<layout.graphicY,'wrong mobile reading order');
    if(route===''&&width>=1024){assert.equal(layout.grid,12);assert.equal(layout.gutter,'32px');}record(`page ${route||'front'} ${width}`,layout);
if([390,500,1440].includes(width))await page.screenshot({path:path.join(evidence,`${route.startsWith('issue/')?'issue':route||'front'}-${width}.png`),fullPage:width===1440});}
   assert.deepEqual(errors,[]);await context.close();record(`responsive ${width}`,{passed:true});
  }
 }
 // Measure contrast from computed foregrounds and the actual opaque ancestor background.
 {
  const {context,page}=await setup(390,{wallet:true});await page.goto(url+'#/trade');await connect(page);await page.locator('#amount').fill('1');await until(()=>page.getByRole('button',{name:'Swap IMD for SCOOP',exact:true}).isEnabled(),'contrast setup did not unlock');
  const contrast=await page.evaluate(()=>{
   const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number);
   const luminance=c=>c.slice(0,3).map(x=>{x/=255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4}).reduce((n,v,i)=>n+v*[0.2126,0.7152,0.0722][i],0);
   const selectors=['body','.field label','.field .hint','.nav [aria-current="page"]','.trade-card > .btn--accent'];
   return selectors.map(selector=>{const el=document.querySelector(selector),style=getComputedStyle(el);let parent=el,bg;while(parent){bg=getComputedStyle(parent).backgroundColor;if(rgb(bg).length===3||rgb(bg)[3]!==0)break;parent=parent.parentElement;}const a=luminance(rgb(style.color)),b=luminance(rgb(bg));return {selector,foreground:style.color,background:bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});
  });
  for(const pair of contrast)assert(pair.ratio>=4.5,`contrast ${pair.selector}: ${pair.ratio}`);
  record('rendered contrast',{pairs:contrast});
  await page.locator('.skip').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'main');await page.locator('#amount').focus();assert.equal(await page.locator('#amount').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');await page.screenshot({path:path.join(evidence,'keyboard-trade-390.png')});
  await page.addStyleTag({content:'html { font-size: 200% !important; }'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'200% text enlargement overflow');record('200% text enlargement trade',{passed:true});
  await context.close();
 }
 assert.deepEqual(consoleErrors,[]);assert.deepEqual(resourceFailures,[]);
 await fs.mkdir(evidence,{recursive:true});await fs.writeFile(path.join(evidence,baseline?'reproduction.json':'browser-results.json'),JSON.stringify({testedAt:new Date().toISOString(),mode:baseline?'before fixes':'regression tests',browser:browser.version(),consoleErrors,resourceFailures,observations:findings},null,2)+'\n');
}finally{await browser.close();await new Promise(r=>server.close(r));}
