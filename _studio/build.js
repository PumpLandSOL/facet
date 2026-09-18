'use strict';
// FACET brand kit → _studio/out/facet-*.html; render.js rasterizes to brand/.
// Every number and listing is read from the running site (default http://localhost:8210), nothing is typed in.
const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const SITE = process.env.SITE || 'http://localhost:8210';
const usd = (n) => n >= 1e9 ? '$' + (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : '$' + Math.round(n).toLocaleString();
const px = (n) => '$' + (n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n >= 1 ? n.toFixed(2) : n.toFixed(4));
const CSS = `@import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}html,body{background:#060907;font-family:'Instrument Sans',sans-serif;color:#ecf6ee;overflow:hidden;-webkit-font-smoothing:antialiased}
.stage{position:relative;overflow:hidden;background:radial-gradient(1200px 700px at 12% -10%,#0f3a1d 0%,transparent 60%),#060907}
.abs{position:absolute}.mono{font-family:'JetBrains Mono',monospace}.sub{color:#a9bcae}.mut{color:#6f8577}.g{color:#00c805}.pos{color:#2fe05a}.neg{color:#ff6a7a}
.h{font-weight:700;letter-spacing:-.035em;line-height:1.02}
.lab{font-size:24px;letter-spacing:.16em;text-transform:uppercase;color:#00c805;font-weight:700}
.logo{display:flex;align-items:center;font-weight:700;letter-spacing:-.03em}
.card{background:#0e1511;border:2px solid #1b2920;border-radius:28px}
.pill{display:inline-flex;align-items:center;border-radius:999px;font-weight:700}
.btn{background:#00c805;color:#03110a}
.gr{display:inline-grid;place-items:center;border-radius:12px;font-family:'JetBrains Mono',monospace;font-weight:500;background:#0a3d1c;color:#2fe05a;border:2px solid #14602c}
.gr.b{background:#2a2412;color:#e0b84a;border-color:#5a4a1c}
.tile{background:#131c16;border:2px solid #1b2920;border-radius:20px;display:grid;place-items:center}
.tile img{border-radius:22%;object-fit:cover}
.foot{left:150px;right:150px;bottom:70px;display:flex;justify-content:space-between;align-items:center;font-size:28px}
.bar{height:18px;border-radius:9px;background:#131c16;overflow:hidden}.bar i{display:block;height:100%;background:#00c805;border-radius:9px}`;
const wrap = (name, w, h, body) => fs.writeFileSync(path.join(OUT, name + '.html'), `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="stage" style="width:${w}px;height:${h}px">${body}</div></body></html>`);
const gem = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 32 32"><path d="M16 3l12 10-12 16L4 13z" fill="#00c805"/><path d="M16 3l5 10-5 16-5-16z" fill="#0a3d1c"/><path d="M4 13h24" stroke="#060907" stroke-width="1.4"/></svg>`;
const logo = (px_) => `<div class="logo" style="font-size:${px_}px;gap:${px_ * .3}px">${gem(px_ * 1.15)}facet</div>`;
const grade = (l, s) => `<span class="gr${/^B|^C/.test(l) && l !== 'BBB' ? ' b' : ''}" style="min-width:${s * 2.1}px;height:${s * 1.25}px;font-size:${s * .55}px;padding:0 ${s * .3}px">${l}</span>`;
const foot = (r) => `<div class="abs foot"><span class="g" style="font-weight:700">facetonrh.xyz</span><span class="mut">${r}</span></div>`;
const top = (label) => `<div class="abs" style="left:150px;top:96px">${logo(64)}</div><div class="abs lab" style="right:150px;top:118px">${label}</div>`;

(async () => {
  const get = async (p) => (await fetch(SITE + p)).json();
  const home = await get('/api/home'); const st = home.stats; const sh = {}; home.shelves.forEach((x) => sh[x.key] = x.items);
  if (!st.assets) throw new Error('site has no listings yet, wait a minute and rerun');
  const paxg = await get('/api/asset/pax-gold'); const cmp = await Promise.all(['PAXG', 'XAUT'].map((q) => get('/api/verify?q=' + q)));
  const tiles = (items, n, s) => items.slice(0, n).map((a) => `<div class="tile" style="width:${s}px;height:${s}px"><img src="${a.image}" width="${s * .56}" height="${s * .56}"></div>`).join('');
  const shelf = (title, items, val) => `<div class="card" style="padding:34px"><div style="font-size:34px;font-weight:700;letter-spacing:-.02em;line-height:1.2;height:84px">${title}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:20px">${items.slice(0, 4).map((a) => `<div><div class="tile" style="height:150px"><img src="${a.image}" width="84" height="84"></div><div style="font-weight:700;font-size:24px;margin-top:10px">${a.symbol}</div><div class="mono sub" style="font-size:22px">${val(a)}</div></div>`).join('')}</div></div>`;

  wrap('facet-pfp', 2000, 2000, `<div class="abs" style="left:0;right:0;top:390px;display:flex;justify-content:center">${gem(820)}</div><div class="abs h" style="left:0;right:0;top:1230px;text-align:center;font-size:330px">facet</div><div class="abs lab" style="left:0;right:0;top:1640px;text-align:center;font-size:48px">real-world assets, graded</div>`);

  wrap('facet-banner', 3000, 1000, `<div class="abs" style="left:150px;top:130px">${logo(96)}</div>
    <div class="abs h" style="left:150px;top:330px;font-size:132px;max-width:1700px">Real-world assets,<br><span class="g">graded</span> before you buy.</div>
    <div class="abs sub" style="left:150px;top:690px;font-size:40px;max-width:1500px">${st.assets.toLocaleString()} tokenized assets. ${usd(st.tracked)} tracked. Supply read straight from the contract.</div>
    <div class="abs" style="right:150px;top:150px;display:grid;grid-template-columns:repeat(3,230px);gap:26px">${tiles([].concat(sh.metals.slice(0, 3), sh.treasuries.slice(0, 3), sh.stocks.slice(0, 3)), 9, 230)}</div>
    <div class="abs" style="left:150px;bottom:90px;display:flex;gap:26px;align-items:center"><span class="pill btn" style="font-size:36px;padding:20px 44px">facetonrh.xyz</span><span class="mut" style="font-size:30px">Treasuries · Gold · Stocks · ETFs · Private credit</span></div>`);

  wrap('facet-keyart', 2400, 1350, `${top('The marketplace for tokenized assets')}
    <div class="abs h" style="left:150px;top:270px;font-size:124px;max-width:1150px">Every real-world asset, <span class="g">in one marketplace.</span></div>
    <div class="abs sub" style="left:150px;top:760px;font-size:36px;line-height:1.4;max-width:1000px">Treasuries, gold, stocks, ETFs and private credit, all tokenized. Each listing graded from six measurable signals, with supply read live from its own contract.</div>
    <div class="abs" style="left:150px;top:1000px;display:flex;gap:70px">${[[st.assets.toLocaleString(), 'Graded listings'], [st.issuers, 'Issuers'], [usd(st.tracked), 'Tracked value']].map((x) => `<div><div class="h" style="font-size:72px">${x[0]}</div><div class="mut" style="font-size:22px;letter-spacing:.14em;text-transform:uppercase;font-weight:600">${x[1]}</div></div>`).join('')}</div>
    <div class="abs" style="right:150px;top:270px;width:920px;display:grid;grid-template-columns:1fr 1fr;gap:26px">${shelf('Gold & metals | Own bullion from $1', sh.metals, (a) => px(a.price))}${shelf('Treasuries & cash | Held in a wallet', sh.treasuries, (a) => px(a.price))}</div>
    ${foot('self-custody from quote to settlement')}`);

  const g = paxg.grade;
  wrap('facet-score', 2400, 1350, `${top('The FACET Score')}
    <div class="abs h" style="left:150px;top:260px;font-size:112px;max-width:1100px">Six signals. 100 points. <span class="g">One grade.</span></div>
    <div class="abs sub" style="left:150px;top:640px;font-size:34px;line-height:1.4;max-width:980px">Every point comes from something anyone can re-measure, and the reason for each one is printed on the listing. Grades run from AAA down to C.</div>
    <div class="abs" style="left:150px;top:900px;display:flex;gap:16px">${['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'C'].map((l) => grade(l, 64)).join('')}</div>
    <div class="abs card" style="right:150px;top:250px;width:1020px;padding:40px 44px"><div style="display:flex;align-items:center;gap:22px;padding-bottom:26px;border-bottom:2px solid #1b2920"><img src="${paxg.asset.image}" width="84" height="84" style="border-radius:20px"><div style="flex:1"><div style="font-size:40px;font-weight:700">${paxg.asset.name}</div><div class="mono sub" style="font-size:26px">${px(paxg.asset.price)}</div></div><div class="mono" style="font-size:38px">${g.score}<span class="mut" style="font-size:24px"> / 100</span></div>${grade(g.letter, 72)}</div>
      ${g.parts.map((p) => `<div style="display:grid;grid-template-columns:250px 1fr 170px;gap:22px;align-items:center;margin-top:26px"><span style="font-size:28px;font-weight:600">${p.k}</span><span class="bar"><i style="width:${Math.round(100 * p.pts / p.max)}%"></i></span><span class="mono" style="font-size:24px;text-align:right">${p.pts} / ${p.max}</span><span class="mut" style="grid-column:2/4;font-size:22px;margin-top:-12px">${p.why}</span></div>`).join('')}</div>
    ${foot('live grade for PAXG at build time')}`);

  wrap('facet-market', 2400, 1350, `${top('Shop by asset class')}
    <div class="abs h" style="left:150px;top:250px;font-size:104px">Only real assets. <span class="g">No narrative coins.</span></div>
    <div class="abs" style="left:150px;right:150px;top:470px;display:grid;grid-template-columns:repeat(4,1fr);gap:26px">${shelf('Treasuries & cash', sh.treasuries, (a) => px(a.price))}${shelf('Gold & metals', sh.metals, (a) => px(a.price))}${shelf('Stocks', sh.stocks, (a) => px(a.price))}${shelf('ETFs & indices', sh.etfs, (a) => px(a.price))}</div>
    ${foot(st.classes.filter((c) => c.n).map((c) => c.n + ' ' + c.label.toLowerCase()).join(' · '))}`);

  const s = paxg.supply;
  wrap('facet-trade', 2400, 1350, `${top('Verify, then trade')}
    <div class="abs h" style="left:150px;top:250px;font-size:104px;max-width:2000px">Read the contract. <span class="g">Then swap from your own wallet.</span></div>
    <div class="abs card" style="left:150px;top:560px;width:1020px;padding:40px 44px"><div class="lab" style="font-size:20px">Supply verification · ${paxg.asset.symbol}</div>${[['Read on-chain, ' + (s && s.chainName || 'Ethereum'), s && s.ok ? s.onchain.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'], ['Published by the issuer', s && s.published ? s.published.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'], ['Difference', s && s.drift != null ? (s.drift >= 0 ? '+' : '') + s.drift + '%' : '—']].map((r) => `<div style="display:flex;justify-content:space-between;padding:26px 0;border-bottom:2px solid #1b2920;font-size:32px"><span class="sub">${r[0]}</span><span class="mono">${r[1]}</span></div>`).join('')}<div class="sub" style="font-size:26px;margin-top:26px;line-height:1.4">FACET calls totalSupply() on the token contract through public nodes and sets it beside the issuer's figure.</div></div>
    <div class="abs card" style="right:150px;top:560px;width:1020px;padding:40px 44px"><div class="lab" style="font-size:20px">Trade · settles from your wallet</div><div style="font-size:34px;line-height:1.45;margin-top:22px">Quotes are routed across on-chain venues by the KyberSwap aggregator.</div><div style="margin-top:28px;display:grid;gap:18px">${['Your wallet signs the swap', 'Tokens arrive at your own address', 'No accounts, no deposits, no custody'].map((t) => `<div style="display:flex;gap:18px;align-items:center;font-size:30px"><span class="pill btn" style="width:40px;height:40px;justify-content:center;font-size:24px">✓</span>${t}</div>`).join('')}</div></div>
    ${foot('Ethereum · Arbitrum · Base · Polygon · BNB Chain')}`);

  const [A, Bc] = cmp; const d = A.grade.score - Bc.grade.score; const win = d >= 0 ? A : Bc;
  const col = (r) => `<div class="card" style="padding:36px 40px"><div style="display:flex;align-items:center;gap:20px;padding-bottom:22px;border-bottom:2px solid #1b2920"><img src="${r.asset.image}" width="76" height="76" style="border-radius:18px"><div style="flex:1"><div style="font-size:36px;font-weight:700">${r.asset.symbol}</div><div class="sub" style="font-size:22px">${r.asset.name}</div></div><span class="mono" style="font-size:34px">${r.grade.score}</span>${grade(r.grade.letter, 64)}</div>${r.grade.parts.map((p) => `<div style="display:grid;grid-template-columns:210px 1fr 100px;gap:18px;align-items:center;margin-top:24px"><span style="font-size:25px;font-weight:600">${p.k}</span><span class="bar"><i style="width:${Math.round(100 * p.pts / p.max)}%"></i></span><span class="mono" style="font-size:22px;text-align:right">${p.pts}/${p.max}</span></div>`).join('')}</div>`;
  wrap('facet-vs', 2400, 1350, `${top('Wrapper against wrapper')}
    <div class="abs h" style="left:150px;top:250px;font-size:104px">Same gold. <span class="g">Which token stands up better?</span></div>
    <div class="abs" style="left:150px;right:150px;top:480px;display:grid;grid-template-columns:1fr 1fr;gap:30px">${col(A)}${col(Bc)}</div>
    <div class="abs pill" style="left:150px;bottom:150px;background:#0d2a17;border:2px solid #14602c;font-size:32px;padding:16px 34px">${d === 0 ? 'Both stand equal at ' + A.grade.score + ' points' : win.asset.symbol + ' stands up better, by ' + Math.abs(d) + ' point' + (Math.abs(d) > 1 ? 's' : '')}</div>
    ${foot('live comparison at build time · grade any token at facetonrh.xyz/verify')}`);
  console.log('built 7 from', SITE, '·', st.assets, 'listings');
})().catch((e) => { console.error(e); process.exit(1); });
