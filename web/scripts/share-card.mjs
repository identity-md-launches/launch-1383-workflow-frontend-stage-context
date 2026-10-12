// Recreate the typography-only social card with the site's existing paper/ink/red palette.
import { chromium } from 'playwright';
const browser=await chromium.launch({executablePath:process.env.SCOOP_CHROMIUM||undefined,args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
 await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8"><style>
 *{box-sizing:border-box}body{margin:0;padding:48px 64px;background:#f6f1e7;color:#141211;font-family:Georgia,'Times New Roman',serif}
 .ears{display:flex;justify-content:space-between;border-top:3px solid #141211;padding-top:16px;font:18px monospace;text-transform:uppercase;letter-spacing:.09em}
 h1{font-size:164px;font-weight:900;line-height:1;margin:25px 0 10px;text-align:center;letter-spacing:-.045em}
 .tag{font-size:27px;text-align:center;margin:0 0 30px;border-bottom:7px double #141211;padding-bottom:28px}
 .lower{display:flex;align-items:center;justify-content:space-between;gap:40px}
 h2{font-size:45px;line-height:1.1;max-width:650px;margin:10px 0 18px;font-weight:700}
 .stamp{color:#b3261e;border:3px solid #b3261e;padding:16px 20px;font:700 20px/1.4 monospace;text-align:center;letter-spacing:.06em}
 .foot{margin-top:14px;padding-top:16px;border-top:1px solid #141211;font:17px monospace;letter-spacing:.1em;text-transform:uppercase}
 </style><div class="ears"><span>The swarm's daily newspaper</span><span>Independent. On chain.</span></div><h1>SCOOP</h1><p class="tag">The scoop on every IMD coin, written by the swarm</p><div class="lower"><h2>A front page for<br>the whole swarm.</h2><div class="stamp">NEW LAUNCHES<br>MOVERS &amp; STORIES</div></div><div class="foot">Read the issue · Book the front page · Trade SCOOP</div></html>`);
 await page.screenshot({path:new URL('../public/share-card.png',import.meta.url).pathname});
} finally {await browser.close();}
