/** Live USD prices for cron jobs: CoinGecko for spot, Hyperliquid mids for perps. */
const COINGECKO_IDS: Record<string, string> = {
  btc: 'bitcoin', eth: 'ethereum', sol: 'solana', bnb: 'binancecoin', xrp: 'ripple', ada: 'cardano', avax: 'avalanche-2',
  dot: 'polkadot', ton: 'the-open-network', sui: 'sui', apt: 'aptos', near: 'near', arb: 'arbitrum', op: 'optimism',
  link: 'chainlink', uni: 'uniswap', aave: 'aave', jup: 'jupiter-exchange-solana', rndr: 'render-token', fet: 'fetch-ai',
  tao: 'bittensor', doge: 'dogecoin', usdc: 'usd-coin', usdt: 'tether', pyusd: 'paypal-usd', dai: 'dai',
};

export async function fetchPrices(assetIds: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const ids = [...new Set(assetIds)].filter((a) => COINGECKO_IDS[a]);
  if (ids.length) {
    const key = Deno.env.get('COINGECKO_API_KEY');
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.map((a) => COINGECKO_IDS[a]).join(',')}&vs_currencies=usd`, {
      headers: key ? { 'x-cg-demo-api-key': key } : {},
    });
    if (res.ok) {
      const data = (await res.json()) as Record<string, { usd: number }>;
      for (const a of ids) {
        const p = data[COINGECKO_IDS[a]!]?.usd;
        if (p !== undefined) out[a] = String(p);
      }
    }
  }
  const mids = (await fetch('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'allMids' }) })
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))) as Record<string, string>;
  for (const a of assetIds) {
    const perp = a.endsWith('-perp') ? a.replace('-perp', '').toUpperCase() : a.toUpperCase();
    if (!out[a] && mids[perp]) out[a] = mids[perp]!;
  }
  return out;
}
