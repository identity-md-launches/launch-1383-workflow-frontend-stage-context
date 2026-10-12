// Production-export interaction tests. RPC and EIP-1193 responses are deterministic fixtures;
// the harness never forwards signing requests or connects to a real wallet.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { decodeFunctionData, encodeFunctionResult, parseEther, zeroAddress } from 'viem';
import { ERC20_ABI, PERMIT2_ABI, QUOTER_ABI, STATE_VIEW_ABI } from '../src/lib/swap.ts';
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
 try{const rel=decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\/preview\//,'');const file=path.resolve(dist,rel);if(!file.startsWith(dist+'/'))throw Error('path');const data=await fs.readFile(file);const ext=path.extname(file);res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[ext]??'application/octet-stream');res.end(data)}catch{res.writeHead(404);res.end()}
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
 const state={failure,bookings,slotFailure,delay,slotDelay,calls:[]};
 const errors=[];const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);consoleErrors.push('pageerror: '+e.message)});
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
 page.on('response',r=>{if(r.url().startsWith(url.split('/preview/')[0])&&r.status()>=400)resourceFailures.push({url:r.url(),status:r.status()})});
 await page.route('https://**',async route=>{
  const payload=route.request().postDataJSON();
  if(state.slotDelay && (Array.isArray(payload)?payload:[payload]).some(q=>{try{return decodeFunctionData({abi:frontAbi,data:q.params?.[0]?.data}).functionName==='slotOf'}catch{return false}}))await new Promise(r=>setTimeout(r,state.slotDelay));
  if(state.delay)await new Promise(r=>setTimeout(r,state.delay));
  function reply(q){
   try{
    if(state.failure)throw Error('Review fixture: RPC unavailable');
    if(q.method==='eth_chainId')return {jsonrpc:'2.0',id:q.id,result:'0x1'};
    if(q.method==='eth_blockNumber')return {jsonrpc:'2.0',id:q.id,result:'0x18f6a00'};
    if(q.method==='eth_getCode')return {jsonrpc:'2.0',id:q.id,result:'0x60006000'};
    if(q.method!=='eth_call')throw Error('Unexpected RPC method '+q.method);
    let decoded,abi;
    const all=[frontAbi,ERC20_ABI,QUOTER_ABI,STATE_VIEW_ABI,PERMIT2_ABI];
    for(const a of all){try{decoded=decodeFunctionData({abi:a,data:q.params[0].data});abi=a;break}catch{}}
    if(!decoded)throw Error('Unknown selector '+q.params[0].data.slice(0,10));
    const {functionName:name,args}=decoded;state.calls.push(name);
    if(name==='slotOf'&&state.slotFailure)throw Error('Review fixture: slot unavailable');
    const slot={buyer:account,token:cfg.contracts[0].address,paid:parseEther('2000000'),burned:false,headline:'Fixture booking',link:''};
    const results={balanceOf:10n**30n,allowance:0n,totalSupply:parseEther('1000000000'),decimals:18,symbol:'SCOOP',price:parseEther('2000000'),nextPrice:[parseEther('2000000'),0n],owner:'0x2222222222222222222222222222222222222222',pendingOwner:zeroAddress,bookedDays:state.bookings.map(BigInt),slotOf:state.bookings.includes(Number(args?.[0]))?slot:{...slot,buyer:zeroAddress,paid:0n,headline:''},getSlot0:[2n**96n,0,0,12500],getLiquidity:10n**24n,quoteExactInputSingle:[parseEther('100'),100000n]};
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
 for(const width of [390,1440]){
  {
   const {context,page,errors}=await setup(width);
   await page.goto(url+'#/trade');await page.locator('#amount').fill('1000000');await until(()=>page.getByText('≈ 100 SCOOP',{exact:true}).count(),'quote missing');
   await page.evaluate(()=>window.scrollTo(0,0));
   const view=await page.evaluate(()=>({og:document.querySelector('meta[property="og:image"]')?.content??null,inputY:document.querySelector('#amount').getBoundingClientRect().y,swapBottom:document.querySelector('.trade-card > .btn--accent').getBoundingClientRect().bottom,cardY:document.querySelector('.trade-card').getBoundingClientRect().y,detailsY:document.querySelector('.trade-details').getBoundingClientRect().y,cardX:document.querySelector('.trade-card').getBoundingClientRect().x,detailsX:document.querySelector('.trade-details').getBoundingClientRect().x,connectors:[...document.querySelectorAll('.walletbar button')].map(x=>x.textContent),overflow:document.documentElement.scrollWidth>innerWidth}));
   record(`layout ${width}`,view);
   if(!baseline){assert(view.og);assert(view.inputY<(width<600?844:900));if(width===390){assert(view.swapBottom<=844,'Swap below first screen');assert(view.cardY<view.detailsY);}else{assert(view.cardX>view.detailsX);}assert(!view.overflow);assert.equal(view.connectors.length,0);assert.match(await page.locator('.walletbar').innerText(),/No wallet found\. Open this site in a wallet browser or install a browser wallet\./);assert.equal(view.og,'https://scoop.sites.imd.fun/share-card.png');assert.equal(await page.locator('meta[name="twitter:card"]').getAttribute('content'),'summary_large_image');const asset=await page.request.get(new URL('./share-card.png',url).href);assert(asset.ok());assert.equal(asset.headers()['content-type'],'image/png');}
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
   const {context,page,state}=await setup(width,{wallet:true,failure:true});await page.goto(url+'#/book');await connect(page);await until(async()=>/Could not read bookings|Bookings unavailable/.test(await page.locator('.legend').innerText()),'error not displayed',20000);
   record(`failed bookings ${width}`,{enabled:await page.locator('.day:enabled').count(),ledger:await page.locator('#burn-h').locator('..').innerText(),mine:await page.locator('#mine-h').locator('..').innerText()});
   if(!baseline){assert.equal(await page.locator('.day:enabled').count(),0);assert.equal(await page.getByText('No bookings in the window.',{exact:true}).count(),0);assert.match(await page.locator('#mine-h').locator('..').innerText(),/Bookings unavailable/);state.failure=false;state.bookings=[today+2];await page.getByRole('button',{name:'Retry bookings',exact:true}).first().click();await until(()=>page.getByText('Fixture booking',{exact:true}).count(),'retry did not recover');assert.equal(await page.locator('.day:enabled').count(),29);assert.equal(await page.locator('.day:disabled').count(),1);await page.goto(url+'#/trade');await page.goto(url+'#/book');await page.locator('#token').fill(cfg.contracts[0].address);await page.locator('#headline').fill('Keep this headline');await page.locator('.day:enabled').first().click();await page.evaluate(()=>window.__setChain('0xa'));await until(()=>page.getByRole('button',{name:'Switch to Ethereum'}).count(),'booking badge stale');assert(await page.getByRole('button',{name:/^Approve and book/}).isDisabled());await page.getByRole('button',{name:'Switch to Ethereum'}).click();await until(()=>page.getByRole('button',{name:/^Approve and book/}).isEnabled(),'booking switch did not unlock');await page.getByRole('button',{name:/^Approve and book/}).click();await until(()=>page.getByText('You rejected the request in your wallet.',{exact:true}).count(),'booking rejection message missing');assert.equal(await page.evaluate(()=>window.__sent),1);assert(await page.getByRole('button',{name:/^Approve and book/}).isEnabled(),'booking did not recover after rejection');}
   await context.close();
  }
 }
 if(!baseline){
  for(const mode of ['loading','slot-loading','slot-error','empty']){
   const {context,page,state}=await setup(390,{wallet:true,delay:mode==='loading'?1500:0,bookings:mode.startsWith('slot-')?[today+1]:[],slotFailure:mode==='slot-error',slotDelay:mode==='slot-loading'?1500:0});await page.goto(url+'#/book');await page.locator('.day').first().waitFor();
   if(mode==='loading'){assert.equal(await page.locator('.day:enabled').count(),0);assert.equal(await page.getByText('No bookings in the window.',{exact:true}).count(),0);}
   if(mode==='slot-loading'){await until(()=>state.calls.includes('bookedDays'),'days not read');assert.equal(await page.locator('.day:enabled').count(),0);await connect(page);assert.equal(await page.getByText(/No bookings from/).count(),0);await until(()=>page.locator('.day:enabled').count(),'slot loading did not recover');}
   if(mode==='slot-error'){await connect(page);await until(()=>page.getByText('Bookings unavailable. Try again.',{exact:true}).count(),'slot error not displayed',20000);assert.equal(await page.locator('.day:enabled').count(),0);assert(await page.getByRole('button',{name:/^Approve and book/}).isDisabled());await page.locator('.day').first().evaluate(el=>{el.disabled=false;el.click();el.disabled=true});assert.equal(await page.locator('.day[aria-pressed=true]').count(),0);assert.equal(await page.getByText('No bookings in the window.',{exact:true}).count(),0);assert.equal(await page.getByText(/No bookings from/).count(),0);state.slotFailure=false;await page.getByRole('button',{name:'Retry bookings'}).first().click();await until(()=>page.getByText('Fixture booking',{exact:true}).count(),'slot retry failed');}
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
   const {context,page}=await setup(390);await page.goto(url+'#/');await page.getByRole('navigation').getByRole('link',{name:'Archive',exact:true}).click();await page.locator('.archive-table a').click();await until(()=>page.getByRole('heading',{name:'SCOOP hits the stands: the swarm gets a daily',exact:true}).count(),'archive issue missing');assert.equal(new URL(page.url()).hash,'#/issue/2026-10-12');await page.getByRole('navigation').getByRole('link',{name:'Buy & sell SCOOP',exact:true}).click();await page.locator('#amount').waitFor();assert.equal(new URL(page.url()).hash,'#/trade');await context.close();record('hash navigation and archived issue',{passed:true});
  }
  await fs.mkdir(evidence,{recursive:true});
  for(const width of [320,390,768,1440]){
   const {context,page,errors}=await setup(width);
   for(const route of ['','trade','book','archive','issue/2026-10-12']){await page.goto(url+'#/'+route);await page.locator('main h2').first().waitFor();await page.waitForTimeout(200);if(width===390&&route==='book'){await until(()=>page.locator('.day:enabled').count(),'calendar not ready');const first=await page.locator('.day:enabled').first().boundingBox();assert(first.y+first.height<=844,'calendar action below first screen');record('first book action 390',{bottom:first.y+first.height});}assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${route} ${width}`);if(width===390||width===1440)await page.screenshot({path:path.join(evidence,`${route.startsWith('issue/')?'issue':route||'front'}-${width}.png`),fullPage:true});}
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
  await page.locator('.skip').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'main');await page.screenshot({path:path.join(evidence,'keyboard-trade-390.png')});
  await page.addStyleTag({content:'html { font-size: 200% !important; }'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'200% text enlargement overflow');record('200% text enlargement trade',{passed:true});
  await context.close();
 }
 assert.deepEqual(consoleErrors,[]);assert.deepEqual(resourceFailures,[]);
 await fs.mkdir(evidence,{recursive:true});await fs.writeFile(path.join(evidence,baseline?'reproduction.json':'browser-results.json'),JSON.stringify({testedAt:new Date().toISOString(),mode:baseline?'before fixes':'regression tests',browser:browser.version(),consoleErrors,resourceFailures,observations:findings},null,2)+'\n');
}finally{await browser.close();await new Promise(r=>server.close(r));}
