import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

let cached: { inrPerSol: number; inrPerUsd: number; ts: number } | null = null;

// CoinCap — free, no API key, works from India, no geo-blocks
async function fetchFromCoinCap(): Promise<{ inrPerSol: number; inrPerUsd: number }> {
  const res = await fetch('https://api.coincap.io/v2/assets/solana', { cache: 'no-store' });
  if (!res.ok) throw new Error(`coincap ${res.status}`);
  const data = (await res.json()) as { data?: { priceUsd?: string } };
  const solUsd = parseFloat(data.data?.priceUsd ?? '0');
  if (!solUsd) throw new Error('coincap missing price');
  const usdInr = 84;
  return { inrPerSol: Math.round(solUsd * usdInr), inrPerUsd: usdInr };
}

// CoinGecko — gives INR directly but rate-limits server-side requests aggressively
async function fetchFromCoinGecko(): Promise<{ inrPerSol: number; inrPerUsd: number }> {
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=inr,usd',
    { cache: 'no-store' },
  );
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  const data = (await res.json()) as { solana?: { inr?: number; usd?: number } };
  if (!data.solana?.inr) throw new Error('coingecko missing inr');
  return { inrPerSol: data.solana.inr, inrPerUsd: data.solana.usd ?? 84 };
}

async function fetchLiveRates(): Promise<{ inrPerSol: number; inrPerUsd: number }> {
  try { return await fetchFromCoinCap(); } catch { /* fall through */ }
  try { return await fetchFromCoinGecko(); } catch { /* fall through */ }
  throw new Error('all rate sources failed');
}

export async function GET() {
  try {
    if (!cached || Date.now() - cached.ts > 30_000) {
      const rates = await fetchLiveRates().catch(() => ({ inrPerSol: 8250, inrPerUsd: 84 }));
      cached = { ...rates, ts: Date.now() };
    }
    return NextResponse.json({ inrPerSol: cached.inrPerSol, inrPerUsd: cached.inrPerUsd });
  } catch {
    return NextResponse.json({ inrPerSol: 8250, inrPerUsd: 84 });
  }
}
