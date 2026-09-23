// one-shot: trim tweets 4 and 7 in X-KIT.md to <= 245 chars, then print every count
const fs = require('fs'), path = require('path'); const f = path.join(__dirname, '..', 'X-KIT.md');
let s = fs.readFileSync(f, 'utf8').replace(/\r/g, '');
const T = {
  4: `Read the contract first.

FACET calls totalSupply() on the token itself and sets it beside what the issuer publishes.

Then swap from your own wallet: routed on-chain, signed by you, settled to your address. No accounts. No custody.

facetonrh.xyz`,
  7: `New on FACET: Best Wrapper.

The same NVDA share is sold by 5 issuers. Right now the cheapest is also the best graded; the dearest costs 0.25% more for the identical share.

Every rival wrapper, ranked on price, grade and liquidity.

facetonrh.xyz/wrappers`,
};
for (const n of Object.keys(T)) s = s.replace(new RegExp('(\\*\\*' + n + ' · [^\\n]*\\n```\\n)[\\s\\S]*?(\\n```)'), (m, a, b) => a + T[n] + b);
fs.writeFileSync(f, s);
[...s.matchAll(/\*\*(\d) · [^\n]*\n```\n([\s\S]*?)\n```/g)].forEach((x) => console.log(x[1], [...x[2]].length));
