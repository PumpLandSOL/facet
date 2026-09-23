// capture real FACET pages for the demo video (server on :8210)
'use strict';
const { open, sleep } = require('./cdp.cjs'); const path = require('path'); const fs = require('fs');
const B = 'http://localhost:8210'; const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const c = await open(B + '/', 1440, 860, 9531); await sleep(4000);
  const S = async (n, wait = 1200) => { await sleep(wait); await c.shot(path.join(OUT, n + '.png')); console.log(n); };
  const go = async (u) => { await c.send('Page.navigate', { url: B + u }); await sleep(3500); };
  await S('01-home');
  await c.ev("window.scrollTo(0, 700); 1"); await S('02-home-list', 800);
  await go('/markets'); await S('03-markets');
  await c.ev("window.scrollTo(0, 600); 1"); await S('04-markets-2', 800);
  await go('/verify?a=PAXG&b=XAUT'); await S('05-verify', 2500);
  await c.ev("(async()=>{const a=document.getElementById('va'),b=document.getElementById('vb');if(a&&b){a.value='PAXG';b.value='XAUT';a.dispatchEvent(new Event('input'));b.dispatchEvent(new Event('input'));const r=document.getElementById('vr');if(r)r.click();}})(); 1"); await S('06-verify-result', 2500);
  await go('/wrappers'); await S('07-wrappers');
  await go('/basket'); await S('08-basket');
  await go('/docs'); await S('09-docs');
  c.close();
})().catch((e) => { console.error(e); process.exit(1); });
