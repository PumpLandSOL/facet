# FACET

A graded marketplace for tokenized real-world assets: treasuries, gold, stocks, ETFs and private credit. Clean-room recreation of the prismassets.shop product idea, in Robinhood black and green.

- Catalogue and prices: CoinGecko, keyless, cached and rate-limited server side. Narrative and protocol coins are filtered out.
- FACET Score: six measurable signals, 100 points, AAA to C, breakdown returned with every grade.
- Supply verification: totalSupply() read through public nodes on Ethereum, Arbitrum, Base, Polygon and BNB Chain, compared with the published figure.
- Trading: KyberSwap aggregator routes, relayed to the user's wallet. The server never holds keys or funds. Solana listings link to Jupiter.
- Baskets with a weighted portfolio grade, wrapper-vs-wrapper compare.

Dependency-free Node. `npm start`, port 8210.

Env: `PORT`, `DATA_PATH`, `FACET_MINT`, `FEE_RECEIVER` (wallet for the routing fee, empty = no fee), `FEE_BPS` (default 50).
