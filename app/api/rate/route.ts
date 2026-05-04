import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Cache the rate for 60 s to avoid hammering coingecko
let cached: { inrPerSol: number; inrPerUsd: number; ts: number } | null = null;

async function fetchLiveRates(): Promise<{ inrPerSol: number; inrPerUsd: number }> {
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=inr,usd',
    { next: { revalidate: 60 } },
  );
  if (!res.ok) throw new Error('coingecko unavailable');
  const data = (await res.json()) as { solana?: { inr?: number; usd?: number } };
  return {
    inrPerSol: data.solana?.inr ?? 13500,
    inrPerUsd: 84.5,
  };
}

export async function GET() {
  try {
    if (!cached || Date.now() - cached.ts > 60_000) {
      const rates = await fetchLiveRates().catch(() => ({ inrPerSol: 13500, inrPerUsd: 84.5 }));
      cached = { ...rates, ts: Date.now() };
    }
    return NextResponse.json({ inrPerSol: cached.inrPerSol, inrPerUsd: cached.inrPerUsd });
  } catch {
    return NextResponse.json({ inrPerSol: 13500, inrPerUsd: 84.5 });
  }
}
