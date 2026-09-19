'use strict';
// Best Wrapper launch graphics → _studio/out/facet-bestwrapper.html and facet-vs-prism.html. Live data from the running site.
const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const SITE = process.env.SITE || 'http://localhost:8210'; const TICKER = process.env.TICKER || 'NVDA';
const src = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');
const CSS = src.slice(src.indexOf('const CSS = `') + 13, src.indexOf('`;\nconst wrap')) + `
.best{display:inline-flex;background:#00c805;color:#03110a;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:4px 14px;font-size:18px}
table{width:100%;border-collapse:collapse}th{font-size:18px;letter-spacing:.1em;text-transform:uppercase;color:#6f8577;text-align:left;padding:14px 16px;border-bottom:2px solid #25382b;font-weight:600}
td{padding:20px 16px;border-bottom:2px solid #1b2920;font-size:28px;vertical-align:middle}td.n,th.n{text-align:right;font-family:'JetBrains Mono',monospace}`;
const wrap = (name, w, h, body) => fs.writeFileSync(path.join(OUT, name + '.html'), `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="stage" style="width:${w}px;height:${h}px">${body}</div></body></html>`);
const gem = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 32 32"><path d="M16 3l12 10-12 16L4 13z" fill="#00c805"/><path d="M16 3l5 10-5 16-5-16z" fill="#0a3d1c"/><path d="M4 13h24" stroke="#060907" stroke-width="1.4"/></svg>`;
const logo = (p) => `<div class="logo" style="font-size:${p}px;gap:${p * .3}px">${gem(p * 1.15)}facet</div>`;
const top = (label) => `<div class="abs" style="left:150px;top:96px">${logo(64)}</div><div class="abs lab" style="right:150px;top:118px">${label}</div>`;
const foot = (r) => `<div class="abs foot"><span class="g" style="font-weight:700">facetonrh.xyz/wrappers</span><span class="mut">${r}</span></div>`;
const grade = (l, s) => `<span class="gr${/^B|^C/.test(l) && l !== 'BBB' ? ' b' : ''}" style="min-width:${s * 2.1}px;height:${s * 1.25}px;font-size:${s * .55}px;padding:0 ${s * .3}px">${l}</span>`;
const px = (n) => '$' + (n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n.toFixed(2));
const usd = (n) => n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(0) + 'K' : '$' + Math.round(n);

(async () => {
  const get = async (p) => (await fetch(SITE + p)).json();
  const all = await get('/api/wrappers'); const G = await get('/api/wrappers/' + TICKER); if (G.error) throw new Error(G.error);
  const table = (rows, n) => `<table><thead><tr><th>Wrapper</th><th>Grade</th><th class="n">Price</th><th class="n">Over cheapest</th><th class="n">24h volume</th></tr></thead><tbody>${rows.slice(0, n).map((r, i) => `<tr><td><div style="display:flex;gap:16px;align-items:center"><img src="${r.image}" width="52" height="52" style="border-radius:14px"><div><b>${r.symbol}</b> ${i === 0 ? '<span class="best">Best wrapper</span>' : ''}<div class="mut" style="font-size:20px">${r.issuer || ''}</div></div></div></td><td>${grade(r.letter, 44)}</td><td class="n">${px(r.price)}</td><td class="n ${r.over === 0 ? 'pos' : 'neg'}">${r.over === 0 ? 'cheapest' : '+' + r.over.toFixed(2) + '%'}</td><td class="n sub">${usd(r.vol)}</td></tr>`).join('')}</tbody></table>`;

  wrap('facet-bestwrapper', 2400, 1350, `${top('New · Best Wrapper')}
    <div class="abs h" style="left:150px;top:250px;font-size:100px;max-width:2100px">The same share, from ${G.n} issuers. <span class="g">One is the better buy.</span></div>
    <div class="abs card" style="left:150px;right:150px;top:520px;padding:26px 34px"><div style="display:flex;justify-content:space-between;align-items:center;padding:6px 16px 18px"><div style="font-size:34px;font-weight:700">${G.name} <span class="mut" style="font-weight:500">(${G.ticker})</span></div><div class="mono sub" style="font-size:24px">gap between issuers ${G.spread.toFixed(2)}%</div></div>${table(G.rows, 5)}</div>
    ${foot(all.total + ' assets · ' + all.wrappers + ' wrappers ranked · live at build time')}`);

  const ROWS = [['Comparing wrappers', 'Two at a time, and you pick the pair', 'Every wrapper of the same asset, found automatically'], ['Coverage', 'The pair you typed in', all.total + ' assets, ' + all.wrappers + ' wrappers, ranked live'], ['The answer you get', 'Which of your two scores higher', 'The best wrapper to buy, named'], ['What decides it', 'Trust grade', 'Grade, price over the cheapest, and liquidity'], ['Price gap between issuers', 'Premium against the real share', 'Every rival issuer side by side, to the basis point']];
  wrap('facet-vs-prism', 2400, 1350, `${top('FACET vs Prism')}
    <div class="abs h" style="left:150px;top:244px;font-size:102px">Prism compares two. <span class="g">FACET ranks them all.</span></div>
    <div class="abs card" style="left:150px;right:150px;top:470px;overflow:hidden"><div style="display:grid;grid-template-columns:.8fr 1fr 1.35fr;background:#040605;border-bottom:3px solid #00c805"><span></span><span style="font-size:26px;font-weight:700;padding:26px 30px;color:#6f8577;letter-spacing:.08em">PRISM</span><span style="font-size:26px;font-weight:700;padding:26px 30px;background:#00c805;color:#03110a;letter-spacing:.08em">FACET</span></div>
      ${ROWS.map((r, i) => `<div style="display:grid;grid-template-columns:.8fr 1fr 1.35fr;align-items:stretch;border-bottom:${i < ROWS.length - 1 ? '2px solid #1b2920' : '0'}"><span class="g" style="font-size:20px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;padding:30px 34px;align-self:center">${r[0]}</span><span class="mut" style="font-size:29px;padding:30px;align-self:center">${r[1]}</span><span style="font-size:31px;font-weight:700;padding:30px;background:rgba(0,200,5,.07);display:flex;align-items:center">${r[2]}</span></div>`).join('')}</div>
    ${foot('Prism column per its public Verify API docs, which compare ?a= and ?b=')}`);
  console.log('built 2 ·', G.ticker, G.n, 'wrappers · best', G.rows[0].symbol);
})().catch((e) => { console.error(e); process.exit(1); });
