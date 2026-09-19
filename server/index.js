'use strict';
// FACET — a graded marketplace for tokenized real-world assets. Dependency-free Node.
// Catalogue + prices: CoinGecko (keyless, cached). On-chain supply: public RPCs. Swap routes: KyberSwap aggregator (keyless).
// The server reads data and relays quotes. It never holds keys and never signs anything.
const http = require('http'); const fs = require('fs'); const path = require('path');

const PORT = +(process.env.PORT || 8210);
const ROOT = path.join(__dirname, '..'); const CLIENT = path.join(ROOT, 'client');
const DATA_PATH = process.env.DATA_PATH || path.join(ROOT, 'data.json');
const TOKEN = 'FACET'; const MINT = process.env.FACET_MINT || '';
const FEE_RECEIVER = (process.env.FEE_RECEIVER || '').toLowerCase();       // wallet that receives the routing fee; empty = no fee charged
const FEE_BPS = +(process.env.FEE_BPS || 50);
const CG = 'https://api.coingecko.com/api/v3'; const UA = 'Mozilla/5.0 (facet)';
const now = () => Date.now(); const r2 = (x) => Math.round(x * 100) / 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- chains we can read and route on ----------
const CHAINS = {
  'ethereum': { id: 1, name: 'Ethereum', kyber: 'ethereum', rpc: ['https://eth.drpc.org', 'https://1rpc.io/eth', 'https://ethereum-rpc.publicnode.com'], explorer: 'https://etherscan.io', native: 'ETH', cgNative: 'ethereum' },
  'arbitrum-one': { id: 42161, name: 'Arbitrum', kyber: 'arbitrum', rpc: ['https://arbitrum.drpc.org', 'https://1rpc.io/arb', 'https://arbitrum-one-rpc.publicnode.com'], explorer: 'https://arbiscan.io', native: 'ETH', cgNative: 'ethereum' },
  'base': { id: 8453, name: 'Base', kyber: 'base', rpc: ['https://base.drpc.org', 'https://1rpc.io/base', 'https://base-rpc.publicnode.com'], explorer: 'https://basescan.org', native: 'ETH', cgNative: 'ethereum' },
  'polygon-pos': { id: 137, name: 'Polygon', kyber: 'polygon', rpc: ['https://polygon.drpc.org', 'https://1rpc.io/matic', 'https://polygon-bor-rpc.publicnode.com'], explorer: 'https://polygonscan.com', native: 'POL', cgNative: 'polygon-ecosystem-token' },
  'binance-smart-chain': { id: 56, name: 'BNB Chain', kyber: 'bsc', rpc: ['https://bsc.drpc.org', 'https://1rpc.io/bnb', 'https://bsc-rpc.publicnode.com'], explorer: 'https://bscscan.com', native: 'BNB', cgNative: 'binancecoin' },
};
const OTHER_CHAINS = { 'solana': 'Solana', 'stellar': 'Stellar', 'avalanche': 'Avalanche', 'optimistic-ethereum': 'Optimism', 'mantle': 'Mantle', 'sui': 'Sui', 'aptos': 'Aptos', 'ton': 'TON', 'tron': 'Tron', 'xrp': 'XRP Ledger', 'plume-network': 'Plume', 'robinhood-chain': 'Robinhood Chain', 'ink': 'Ink', 'sei-v2': 'Sei', 'hyperevm': 'HyperEVM', 'algorand': 'Algorand', 'near-protocol': 'NEAR' };
const NATIVE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// ---------- classification: only asset-backed tokens are listed. Protocol and narrative coins are dropped. ----------
const CLASSES = [
  { key: 'treasuries', label: 'Treasuries & cash', re: /treasur|t-bill|government|money market|liquidity fund|\busyc\b|dollar yield|\bylds\b|overnight|digital interest|reserve vehicle|short-term|mtbill|govies|opendollar|money fund|bond fund|aggregate bond|tips bond|treasury bond/i },
  { key: 'credit', label: 'Private credit', re: /\bclo\b|credit|heloc|tradable |reinsurance|trade finance|receivables|liquidstone|nest .* vault|securitize fund/i },
  { key: 'metals', label: 'Gold & metals', re: /\bgold\b|silver|precious metal|uranium|emerald|platinum|palladium|\bxau/i },
  { key: 'etfs', label: 'ETFs & indices', re: /\betf\b|s&p|sp500|nasdaq|index|ishares|spdr|russell|\bqqq\b/i },
  { key: 'stocks', label: 'Stocks', re: /xstock|bstock|rstock|tokenized stock|ondo tokenized|robinhood token|backpack securities|prestocks|pre-ipo|\bbacked /i },
  { key: 'property', label: 'Real estate', re: /real estate|realtoken|residential|property|reental|\brent\b/i },
];
const ISSUERS = [[/xstock/i, 'Backed · xStocks'], [/bstock/i, 'bStocks'], [/rstock/i, 'rStocks'], [/ondo|usdy|ousg/i, 'Ondo Finance'], [/robinhood token/i, 'Robinhood'], [/backpack/i, 'Backpack Securities'], [/republic/i, 'Republic'], [/prestocks/i, 'PreStocks'], [/^backed /i, 'Backed Finance'], [/spiko/i, 'Spiko'], [/tradable/i, 'Tradable'], [/janus henderson|anemoy/i, 'Centrifuge · Anemoy'], [/blackrock/i, 'BlackRock · Securitize'], [/franklin/i, 'Franklin Templeton'], [/fidelity/i, 'Fidelity'], [/superstate|invesco short/i, 'Superstate'], [/securitize|apollo/i, 'Securitize'], [/tether gold/i, 'Tether'], [/pax gold/i, 'Paxos'], [/kinesis/i, 'Kinesis'], [/matrixdock/i, 'Matrixdock'], [/circle usyc|hashnote/i, 'Circle · Hashnote'], [/midas/i, 'Midas'], [/openeden/i, 'OpenEden'], [/vaneck/i, 'VanEck'], [/ubs/i, 'UBS'], [/sygnum/i, 'Sygnum'], [/figure/i, 'Figure'], [/maple|syrup/i, 'Maple'], [/nest /i, 'Nest · Plume'], [/theo /i, 'Theo'], [/onre/i, 'OnRe'], [/vnx/i, 'VNX'], [/streamex/i, 'Streamex']];
const DROP = /^(chainlink|stellar|ondo-finance|quant-network|algorand|injective-protocol|xdce-crowd-sale|hash-2|syrup|zebec-network|origintrail|collector-crypt|reserve-rights-token|plume|velo|redstone-oracles|creditcoin-2|keeta|polymesh|centrifuge-2|dusk-network|casper-network|ravencoin|propy|securitize-corp|mantra|clearpool|energy-web-token|usual|openeden|strikecoin|staked-usdt|blockchain-capital)$/;
function classify(c) {
  if (DROP.test(c.id)) return null; const n = c.name + ' ' + c.symbol;
  for (const k of CLASSES) if (k.re.test(n)) { if (k.key === 'metals' && /xstock|bstock|ondo tokenized|robinhood token/i.test(n)) return /etf|trust|shares/i.test(n) ? 'etfs' : 'stocks'; return k.key; }
  return null;
}
const issuerOf = (name) => { for (const [re, who] of ISSUERS) if (re.test(name)) return who; return null; };

// ---------- state ----------
let db = { assets: {}, details: {}, charts: {}, supply: {}, updated: 0 };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))); } catch (e) {}
let saveT = null; const dirty = () => { if (saveT) return; saveT = setTimeout(() => { saveT = null; fs.writeFile(DATA_PATH, JSON.stringify(db), () => {}); }, 4000); };

// ---------- CoinGecko: one request at a time, spaced, with backoff ----------
const Q = []; let cgBusy = false; let cgWait = 7000;
function cg(pathq, pri) { return new Promise((resolve, reject) => { const job = { pathq, resolve, reject }; if (pri) Q.unshift(job); else Q.push(job); pump(); }); }
async function pump() {
  if (cgBusy || !Q.length) return; cgBusy = true; const job = Q.shift();
  try {
    const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 20000);
    const r = await fetch(CG + job.pathq, { headers: { accept: 'application/json', 'user-agent': UA }, signal: ac.signal }); clearTimeout(tm);
    if (r.status === 429) { cgWait = Math.min(90000, cgWait * 2); throw new Error('rate limited'); }
    if (!r.ok) throw new Error('coingecko ' + r.status); cgWait = 7000; job.resolve(await r.json());
  } catch (e) { job.reject(e); }
  setTimeout(() => { cgBusy = false; pump(); }, cgWait);
}
const FEEDS = [['real-world-assets-rwa', 1], ['tokenized-gold', 1], ['tokenized-stock', 1], ['tokenized-stock', 2], ['tokenized-silver', 1]]; let feedI = 0;
async function pollCatalogue() {
  const [cat, page] = FEEDS[feedI++ % FEEDS.length];
  try {
    const rows = await cg('/coins/markets?vs_currency=usd&category=' + cat + '&per_page=250&page=' + page + '&price_change_percentage=24h,7d,30d');
    let n = 0;
    for (const c of rows) {
      if (DROP.test(c.id)) { delete db.assets[c.id]; continue; } let cls = classify(c); if (!cls && cat === 'tokenized-gold') cls = 'metals'; if (!cls && cat === 'tokenized-silver') cls = 'metals'; if (!cls && cat === 'tokenized-stock') cls = /etf|trust|index/i.test(c.name) ? 'etfs' : 'stocks';
      if (!cls || !(c.current_price > 0)) continue;
      const prev = db.assets[c.id] || {};
      db.assets[c.id] = Object.assign(prev, { id: c.id, symbol: String(c.symbol || '').toUpperCase(), name: c.name, image: c.image, cls, issuer: issuerOf(c.name),
        price: c.current_price, mcap: c.market_cap || 0, vol: c.total_volume || 0, ch24: c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? null,
        ch7: c.price_change_percentage_7d_in_currency ?? null, ch30: c.price_change_percentage_30d_in_currency ?? null, supply: c.circulating_supply || c.total_supply || 0,
        ath: c.ath, athDate: c.ath_date, atlDate: c.atl_date, seen: now(), firstSeen: prev.firstSeen || now() }); n++;
    }
    db.updated = now(); regrade(); buildWrappers(); dirty(); console.log('catalogue', cat, 'p' + page, '+' + n, 'total', Object.keys(db.assets).length);
  } catch (e) { console.log('catalogue', cat, String(e.message || e)); }
}

// ---------- grading: every point comes from a measurable signal, and the breakdown is returned with the grade ----------
let GOLD_OZ = 0;
function regrade() {
  const gold = Object.values(db.assets).filter((a) => a.cls === 'metals' && /gold/i.test(a.name) && a.price > 1500 && a.mcap > 5e7).map((a) => a.price).sort((x, y) => x - y);
  GOLD_OZ = gold.length ? gold[Math.floor(gold.length / 2)] : 0;
  for (const a of Object.values(db.assets)) a.grade = gradeOf(a);
}
function gradeOf(a) {
  const parts = [];
  const size = a.mcap > 0 ? clamp((Math.log10(a.mcap) - 5.5) / (9.3 - 5.5), 0, 1) : 0; parts.push({ k: 'Size', max: 25, pts: r2(size * 25), why: a.mcap > 0 ? '$' + fmt(a.mcap) + ' tracked value' : 'no market cap reported' });
  const turn = a.mcap > 0 ? a.vol / a.mcap : 0; const liq = clamp(Math.max(clamp((Math.log10(Math.max(a.vol, 1)) - 3.5) / (7.5 - 3.5), 0, 1), clamp(turn / 0.05, 0, 1) * 0.8), 0, 1);
  const navClass = a.cls === 'treasuries' || a.cls === 'credit'; const liqPts = navClass ? Math.max(10, r2(liq * 20)) : r2(liq * 20);
  parts.push({ k: 'Liquidity', max: 20, pts: liqPts, why: navClass && liqPts === 10 ? 'subscribed and redeemed at NAV with the issuer, little secondary trading' : '$' + fmt(a.vol) + ' traded in 24h' });
  const d = db.details[a.id]; const evm = d ? d.contracts.filter((c) => CHAINS[c.chain]) : []; const s = db.supply[a.id];
  let chainPts = 0, chainWhy = 'contract not yet read'; if (d) { if (s && s.ok) { chainPts = 20; chainWhy = 'supply read live from ' + s.chainName; } else if (d.contracts.length) { chainPts = evm.length ? 12 : 10; chainWhy = d.contracts.length + ' published contract' + (d.contracts.length > 1 ? 's' : '') + (evm.length ? '' : ', none on a chain we read'); } else chainWhy = 'no contract published'; }
  parts.push({ k: 'On-chain proof', max: 20, pts: chainPts, why: chainWhy });
  let driftPts = 0, driftWhy = 'not measured'; if (s && s.ok && s.drift != null) { const ad = Math.abs(s.drift); driftPts = ad < 0.5 ? 15 : ad < 2 ? 12 : ad < 10 ? 7 : ad < 40 ? 3 : 0; driftWhy = 'on-chain supply is ' + (ad < 0.01 ? 'equal to' : r2(s.drift) + '% vs') + ' the published figure'; } else if (s && s.ok) { driftPts = 6; driftWhy = 'supply read, no published figure to compare'; }
  parts.push({ k: 'Supply match', max: 15, pts: driftPts, why: driftWhy });
  const born = Date.parse(a.atlDate || '') && Date.parse(a.athDate || '') ? Math.min(Date.parse(a.atlDate), Date.parse(a.athDate)) : (a.firstSeen || now()); const ageY = (now() - born) / (365 * 86400000);
  parts.push({ k: 'Track record', max: 10, pts: r2(clamp(ageY / 3, 0, 1) * 10), why: ageY >= 1 ? r2(ageY) + ' years of price history' : Math.max(1, Math.round(ageY * 12)) + ' months of price history' });
  let trk = 5, trkWhy = 'no reference to track';
  if (a.cls === 'metals' && GOLD_OZ && /gold/i.test(a.name) && a.price > GOLD_OZ * 0.5) { const off = Math.abs(a.price / GOLD_OZ - 1) * 100; trk = off < 0.3 ? 10 : off < 1 ? 8 : off < 3 ? 5 : 1; trkWhy = r2(off) + '% from the median gold-ounce token'; }
  else if (a.cls === 'treasuries' || a.cls === 'credit') { const v = Math.abs(a.ch30 || 0); trk = v < 1.5 ? 10 : v < 4 ? 7 : v < 10 ? 3 : 0; trkWhy = '30-day move of ' + r2(a.ch30 || 0) + '%, NAV products should drift slowly'; }
  parts.push({ k: 'Tracking', max: 10, pts: trk, why: trkWhy });
  const score = Math.round(parts.reduce((t, p) => t + p.pts, 0));
  const letter = score >= 85 ? 'AAA' : score >= 75 ? 'AA' : score >= 65 ? 'A' : score >= 55 ? 'BBB' : score >= 45 ? 'BB' : score >= 35 ? 'B' : 'C';
  return { score, letter, parts, full: !!d };
}
function fmt(n) { n = +n || 0; return n >= 1e9 ? r2(n / 1e9) + 'B' : n >= 1e6 ? r2(n / 1e6) + 'M' : n >= 1e3 ? r2(n / 1e3) + 'K' : String(r2(n)); }

// ---------- detail, chart, on-chain supply ----------
async function detail(id) {
  const c = db.details[id]; if (c && now() - c.ts < 6 * 3600000) return c;
  const j = await cg('/coins/' + id + '?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false', true);
  const contracts = Object.entries(j.detail_platforms || {}).filter(([k, v]) => k && v && v.contract_address).map(([k, v]) => ({ chain: k, chainName: (CHAINS[k] || {}).name || OTHER_CHAINS[k] || k, address: v.contract_address, decimals: v.decimal_place, evm: !!CHAINS[k], explorer: CHAINS[k] ? CHAINS[k].explorer + '/token/' + v.contract_address : null }));
  const d = { ts: now(), contracts, about: String((j.description || {}).en || '').replace(/<[^>]+>/g, '').slice(0, 1400), home: ((j.links || {}).homepage || []).filter(Boolean)[0] || null, docs: ((j.links || {}).whitepaper) || null, genesis: j.genesis_date || null, totalSupply: (j.market_data || {}).total_supply || null, circ: (j.market_data || {}).circulating_supply || null, cats: j.categories || [] };
  db.details[id] = d; dirty(); readSupply(id).catch(() => {}); return d;
}
async function rpc(urls, method, params) { let last; for (const url of [].concat(urls)) { try { return await rpc1(url, method, params); } catch (e) { last = e; } } throw last; }
async function rpc1(url, method, params) { const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 9000); const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: ac.signal }); clearTimeout(tm); const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result; }
async function readSupply(id) {
  const c = db.supply[id]; if (c && now() - c.ts < 15 * 60000) return c; const d = db.details[id]; if (!d) return null;
  const evm = d.contracts.filter((x) => CHAINS[x.chain]); if (!evm.length) { db.supply[id] = { ts: now(), ok: false, why: 'no contract on a chain FACET reads' }; return db.supply[id]; }
  let total = 0; const per = [];
  for (const x of evm.slice(0, 4)) { try { const ch = CHAINS[x.chain]; const [sup, dec] = await Promise.all([rpc(ch.rpc, 'eth_call', [{ to: x.address, data: '0x18160ddd' }, 'latest']), rpc(ch.rpc, 'eth_call', [{ to: x.address, data: '0x313ce567' }, 'latest'])]); const decimals = dec && dec !== '0x' ? Number(BigInt(dec)) : (x.decimals || 18); const v = Number(BigInt(sup)) / 10 ** decimals; per.push({ chain: x.chain, chainName: ch.name, supply: v }); total += v; } catch (e) { per.push({ chain: x.chain, chainName: CHAINS[x.chain].name, error: String(e.message || e).slice(0, 80) }); } }
  const okRows = per.filter((p) => p.supply != null); const pub = d.totalSupply || d.circ || (db.assets[id] || {}).supply || null; const allEvm = evm.length === d.contracts.length;
  const s = { ts: now(), ok: okRows.length > 0, per, onchain: total, published: pub, drift: okRows.length && pub && allEvm ? r2((total / pub - 1) * 100) : null, partial: !allEvm, chainName: okRows.map((p) => p.chainName).join(' + ') };
  db.supply[id] = s; if (db.assets[id]) db.assets[id].grade = gradeOf(db.assets[id]); dirty(); return s;
}
async function chart(id, days) { const k = id + ':' + days; const c = db.charts[k]; if (c && now() - c.ts < 30 * 60000) return c.pts; const j = await cg('/coins/' + id + '/market_chart?vs_currency=usd&days=' + days, true); const raw = j.prices || []; const step = Math.max(1, Math.floor(raw.length / 180)); const pts = raw.filter((_, i) => i % step === 0).map((p) => [p[0], +p[1].toPrecision(7)]); db.charts[k] = { ts: now(), pts }; return pts; }

// ---------- swap routing (KyberSwap aggregator). The wallet signs; FACET only relays the route. ----------
async function kyber(chain, pathq, body) { const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 15000); const r = await fetch('https://aggregator-api.kyberswap.com/' + chain + pathq, { method: body ? 'POST' : 'GET', headers: { 'x-client-id': 'facet', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: ac.signal }); clearTimeout(tm); const j = await r.json(); if (j.code !== 0) throw new Error(j.message || 'no route'); return j.data; }
const feeQ = () => (FEE_RECEIVER && FEE_BPS > 0 ? '&feeAmount=' + FEE_BPS + '&isInBps=true&chargeFeeBy=currency_in&feeReceiver=' + FEE_RECEIVER : '');

// ---------- Best Wrapper: every token of the same underlying, found automatically and ranked ----------
// The underlying ticker is derived from each issuer's own symbol convention. Gold-ounce tokens form one more group.
function underlyingOf(a) {
  const s = a.symbol, n = a.name;
  if (a.cls === 'metals') return GOLD_OZ && /gold/i.test(n) && Math.abs(a.price / GOLD_OZ - 1) < 0.04 ? 'GOLD' : null;
  if (a.cls !== 'stocks' && a.cls !== 'etfs') return null;
  if (/xstock/i.test(n)) return s.replace(/X$/, ''); if (/ondo/i.test(n)) return s.replace(/ON$/, ''); if (/bstock/i.test(n)) return s.replace(/B$/, '');
  if (/rstock/i.test(n)) return s.replace(/^R/, ''); if (/robinhood token|backpack securities/i.test(n)) return s; return null;
}
const REF = {};   // real share prices from the exchange tape (Yahoo), only used while fresh
let WRAP = { ts: 0, groups: [], by: {} };
function buildWrappers() {
  const g = {}; for (const a of live()) { const u = underlyingOf(a); if (!u) continue; (g[u] = g[u] || []).push(a); }
  const groups = [];
  for (const [ticker, arr] of Object.entries(g)) {
    if (arr.length < 2) continue; const prices = arr.map((x) => x.price).sort((x, y) => x - y); const med = prices[Math.floor(prices.length / 2)];
    const ok = arr.filter((x) => Math.abs(x.price / med - 1) < 0.08); if (ok.length < 2) continue;      // drop tokens that are not 1:1 with the rest
    const cheapest = Math.min(...ok.map((x) => x.price));
    const rows = ok.map((x) => { const over = r2((x.price / cheapest - 1) * 100); const liquid = x.vol >= 10000; const value = r2((x.grade ? x.grade.score : 0) - 12 * over - (liquid ? 0 : 15)); return Object.assign(lite(x), { over, liquid, value }); }).sort((x, y) => y.value - x.value);
    const ref = REF[ticker] && now() - REF[ticker].ts < 20 * 60000 ? REF[ticker] : null;
    if (ref) for (const r of rows) r.vsShare = r2((r.price / ref.px - 1) * 100);
    const name = ticker === 'GOLD' ? 'One troy ounce of gold' : rows[0].name.replace(/\s*(xStock|rStock|\([^)]*\)|• Robinhood Token)\s*/gi, ' ').trim();
    groups.push({ ticker, name, n: rows.length, spread: r2((Math.max(...ok.map((x) => x.price)) / cheapest - 1) * 100), cheapest, best: rows[0].id, bestSymbol: rows[0].symbol, mcap: ok.reduce((t, x) => t + x.mcap, 0), vol: ok.reduce((t, x) => t + x.vol, 0), ref: ref ? { px: ref.px, exch: ref.exch, ts: ref.ts } : null, rows });
  }
  groups.sort((x, y) => (y.n - x.n) || (y.vol - x.vol)); const by = {}; for (const G of groups) { by[G.ticker] = G; for (const r of G.rows) by['id:' + r.id] = G; }
  WRAP = { ts: now(), groups, by };
}
let refI = 0;
async function pollRef() {
  const list = WRAP.groups.filter((G) => G.ticker !== 'GOLD'); if (!list.length) return; const G = list[refI++ % list.length];
  try { const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 8000); const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(G.ticker) + '?range=1d&interval=1m&includePrePost=true', { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0' }, signal: ac.signal }); clearTimeout(tm);
    const res = (await r.json()).chart.result[0]; const closes = ((res.indicators.quote[0] || {}).close || []); const tsArr = res.timestamp || []; let k = closes.length - 1; while (k >= 0 && closes[k] == null) k--;
    if (k >= 0 && Math.abs(closes[k] / G.cheapest - 1) < 0.15) REF[G.ticker] = { px: +closes[k].toFixed(4), ts: tsArr[k] * 1000, exch: res.meta.exchangeName || 'exchange' }; } catch (e) {}
}

// ---------- projections ----------
const lite = (a) => ({ id: a.id, symbol: a.symbol, name: a.name, image: a.image, cls: a.cls, issuer: a.issuer, price: a.price, mcap: a.mcap, vol: a.vol, ch24: a.ch24, ch7: a.ch7, ch30: a.ch30, score: a.grade ? a.grade.score : 0, letter: a.grade ? a.grade.letter : 'C' });
const live = () => Object.values(db.assets).filter((a) => now() - (a.seen || 0) < 3 * 86400000);
function stats() { const L = live(); const by = {}; for (const a of L) by[a.cls] = (by[a.cls] || 0) + 1; return { assets: L.length, issuers: new Set(L.map((a) => a.issuer).filter(Boolean)).size, tracked: L.reduce((t, a) => t + (a.mcap || 0), 0), volume: L.reduce((t, a) => t + (a.vol || 0), 0), byClass: by, classes: CLASSES.map((c) => ({ key: c.key, label: c.label, n: by[c.key] || 0 })), goldOz: GOLD_OZ, updated: db.updated, token: TOKEN, mint: MINT, fee: FEE_RECEIVER ? FEE_BPS : 0 }; }
function find(q) { q = String(q || '').trim().toLowerCase(); if (!q) return null; const L = live(); return L.find((a) => a.id === q) || L.filter((a) => a.symbol.toLowerCase() === q).sort((x, y) => y.mcap - x.mcap)[0] || L.filter((a) => a.name.toLowerCase().includes(q)).sort((x, y) => y.mcap - x.mcap)[0] || null; }

// ---------- http ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.json': 'application/json', '.ico': 'image/x-icon' };
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
const body = (req) => new Promise((resolve) => { let s = ''; req.on('data', (d) => { s += d; if (s.length > 2e5) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch (e) { resolve({}); } }); });
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); const p = u.pathname;
  try {
    if (p === '/api/stats') return json(res, 200, stats());
    if (p === '/api/assets') {
      let L = live(); const cls = u.searchParams.get('class'); const q = (u.searchParams.get('q') || '').toLowerCase(); const sort = u.searchParams.get('sort') || 'mcap';
      if (cls) { const set = cls.split(','); L = L.filter((a) => set.includes(a.cls)); } if (q) L = L.filter((a) => (a.symbol + ' ' + a.name + ' ' + (a.issuer || '')).toLowerCase().includes(q));
      const key = { mcap: (a) => a.mcap, vol: (a) => a.vol, grade: (a) => (a.grade || {}).score || 0, ch24: (a) => a.ch24 ?? -1e9, ch30: (a) => a.ch30 ?? -1e9, price: (a) => a.price, newest: (a) => a.firstSeen || 0 }[sort] || ((a) => a.mcap);
      L.sort((x, y) => key(y) - key(x)); const off = +u.searchParams.get('offset') || 0; const lim = clamp(+u.searchParams.get('limit') || 60, 1, 200);
      return json(res, 200, { total: L.length, items: L.slice(off, off + lim).map(lite) });
    }
    if (p === '/api/home') { const L = live(); const top = (cls, n, f) => L.filter((a) => cls.includes(a.cls)).sort(f || ((x, y) => y.mcap - x.mcap)).slice(0, n).map(lite);
      return json(res, 200, { stats: stats(), shelves: [{ key: 'treasuries', title: 'Treasuries & cash', note: 'Government paper and money funds, on-chain', items: top(['treasuries'], 8) }, { key: 'metals', title: 'Gold & metals', note: 'Vaulted bullion you can hold in a wallet', items: top(['metals'], 8) }, { key: 'stocks', title: 'Stocks', note: 'Share-backed tokens, ranked by size', items: top(['stocks'], 8) }, { key: 'etfs', title: 'ETFs & indices', note: 'Whole markets in one token', items: top(['etfs'], 8) }, { key: 'credit', title: 'Private credit', note: 'Loan books and structured credit', items: top(['credit'], 8) }],
        wrapStats: { groups: WRAP.groups.length, wrappers: WRAP.groups.reduce((t, G) => t + G.n, 0), widest: WRAP.groups.slice().filter((G) => G.vol > 50000).sort((x, y) => y.spread - x.spread).slice(0, 4) }, movers: L.filter((a) => a.ch30 != null && a.mcap > 1e7 && a.vol > 5e4 && Math.abs(a.ch30) < 300).sort((x, y) => Math.abs(y.ch30) - Math.abs(x.ch30)).slice(0, 8).map(lite), traded: L.slice().sort((x, y) => y.vol - x.vol).slice(0, 8).map(lite), finest: L.filter((a) => a.mcap > 1e7).sort((x, y) => (y.grade.score - x.grade.score) || (y.mcap - x.mcap)).slice(0, 8).map(lite) }); }
    if (p.startsWith('/api/asset/')) { const a = db.assets[decodeURIComponent(p.slice(11))]; if (!a) return json(res, 404, { error: 'no such listing' }); let d = db.details[a.id] || null; try { d = await detail(a.id); } catch (e) {} let s = db.supply[a.id] || null; if (d && !s) { try { s = await readSupply(a.id); } catch (e) {} }
      a.grade = gradeOf(a); const related = live().filter((x) => x.cls === a.cls && x.id !== a.id).sort((x, y) => y.mcap - x.mcap).slice(0, 6).map(lite);
      return json(res, 200, { asset: Object.assign(lite(a), { supply: a.supply, ath: a.ath, athDate: a.athDate }), grade: a.grade, detail: d, supply: s, related, wrappers: (WRAP.by['id:' + a.id] || null), routable: d ? d.contracts.filter((c) => c.evm).map((c) => ({ chain: c.chain, chainName: c.chainName, chainId: CHAINS[c.chain].id, address: c.address, native: CHAINS[c.chain].native })) : [], solana: d ? (d.contracts.find((c) => c.chain === 'solana') || {}).address || null : null }); }
    if (p.startsWith('/api/chart/')) { const id = decodeURIComponent(p.slice(11)); if (!db.assets[id]) return json(res, 404, { error: 'no such listing' }); const days = ['1', '7', '30', '90', '365'].includes(u.searchParams.get('days')) ? u.searchParams.get('days') : '30'; try { return json(res, 200, { pts: await chart(id, days) }); } catch (e) { return json(res, 200, { pts: [], error: 'chart feed busy, try again shortly' }); } }
    if (p === '/api/wrappers') { if (now() - WRAP.ts > 60000) buildWrappers(); const q = (u.searchParams.get('q') || '').toUpperCase(); const L = q ? WRAP.groups.filter((G) => G.ticker.includes(q) || G.name.toUpperCase().includes(q)) : WRAP.groups; return json(res, 200, { total: L.length, wrappers: L.reduce((t, G) => t + G.n, 0), widest: WRAP.groups.slice().sort((x, y) => y.spread - x.spread).slice(0, 6).map((G) => ({ ticker: G.ticker, name: G.name, n: G.n, spread: G.spread, bestSymbol: G.bestSymbol })), groups: L.slice(0, 150) }); }
    if (p.startsWith('/api/wrappers/')) { if (now() - WRAP.ts > 60000) buildWrappers(); const G = WRAP.by[decodeURIComponent(p.slice(14)).toUpperCase()]; return G ? json(res, 200, G) : json(res, 404, { error: 'no group for that ticker' }); }
    if (p === '/api/verify') { const a = find(u.searchParams.get('q')); if (!a) return json(res, 404, { error: 'nothing in the register matches that' }); try { await detail(a.id); await readSupply(a.id); } catch (e) {} a.grade = gradeOf(a); return json(res, 200, { asset: lite(a), grade: a.grade, supply: db.supply[a.id] || null }); }
    if (p === '/api/basket') { const ids = (u.searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, 30); const ws = (u.searchParams.get('w') || '').split(',').map(Number); const rows = ids.map((id, i) => ({ a: db.assets[id], w: ws[i] > 0 ? ws[i] : 1 })).filter((x) => x.a); if (!rows.length) return json(res, 200, { items: [], score: 0, letter: '-' }); const tw = rows.reduce((t, x) => t + x.w, 0);
      const score = Math.round(rows.reduce((t, x) => t + x.a.grade.score * x.w, 0) / tw); const weakest = rows.slice().sort((x, y) => x.a.grade.score - y.a.grade.score)[0].a; const ch30 = rows.reduce((t, x) => t + (x.a.ch30 || 0) * x.w, 0) / tw; const mix = {}; for (const x of rows) mix[x.a.cls] = r2((mix[x.a.cls] || 0) + 100 * x.w / tw);
      return json(res, 200, { items: rows.map((x) => Object.assign(lite(x.a), { weight: r2(100 * x.w / tw) })), score, letter: score >= 85 ? 'AAA' : score >= 75 ? 'AA' : score >= 65 ? 'A' : score >= 55 ? 'BBB' : score >= 45 ? 'BB' : score >= 35 ? 'B' : 'C', weakest: lite(weakest), ch30: r2(ch30), mix }); }
    if (p === '/api/quote') { const ch = CHAINS[u.searchParams.get('chain')]; const out = u.searchParams.get('tokenOut'); const amt = u.searchParams.get('amountIn'); if (!ch || !/^0x[a-fA-F0-9]{40}$/.test(out || '') || !/^\d{6,30}$/.test(amt || '')) return json(res, 400, { error: 'bad quote request' });
      try { const d = await kyber(ch.kyber, '/api/v1/routes?tokenIn=' + NATIVE + '&tokenOut=' + out + '&amountIn=' + amt + feeQ()); return json(res, 200, { routeSummary: d.routeSummary, routerAddress: d.routerAddress, chainId: ch.id, native: ch.native }); } catch (e) { return json(res, 200, { error: String(e.message || e) }); } }
    if (p === '/api/build' && req.method === 'POST') { const b = await body(req); const ch = CHAINS[b.chain]; if (!ch || !b.routeSummary || !/^0x[a-fA-F0-9]{40}$/.test(b.sender || '')) return json(res, 400, { error: 'bad build request' });
      try { const d = await kyber(ch.kyber, '/api/v1/route/build', { routeSummary: b.routeSummary, sender: b.sender, recipient: b.sender, slippageTolerance: clamp(+b.slippageBps || 100, 10, 1000), source: 'facet' }); return json(res, 200, { to: d.routerAddress, data: d.data, value: '0x' + BigInt(d.transactionValue || d.amountIn).toString(16), amountOut: d.amountOut, chainId: ch.id }); } catch (e) { return json(res, 200, { error: String(e.message || e) }); } }
    if (p.startsWith('/api/')) return json(res, 404, { error: 'not found' });
    // static + SPA fallback
    let f = path.join(CLIENT, p === '/' ? 'index.html' : p); if (p.startsWith('/brand/')) f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(CLIENT, 'index.html');
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  } catch (e) { json(res, 500, { error: String(e.message || e) }); }
});
// background: read contracts and supply for the largest listings first, slowly, so grades are complete before anyone asks
async function warm() { if (Q.length > 2) return; const next = live().filter((a) => !db.details[a.id] || now() - db.details[a.id].ts > 6 * 3600000).sort((x, y) => y.mcap - x.mcap)[0]; if (!next) return; try { await detail(next.id); await readSupply(next.id); } catch (e) {} }
regrade(); pollCatalogue(); setInterval(pollCatalogue, 45000); setInterval(warm, 20000); buildWrappers(); setInterval(pollRef, 2500);
server.listen(PORT, () => console.log('FACET on :' + PORT + ' · ' + Object.keys(db.assets).length + ' listings cached · fee ' + (FEE_RECEIVER ? FEE_BPS + 'bps → ' + FEE_RECEIVER : 'off')));
