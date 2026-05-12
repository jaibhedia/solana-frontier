import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

const TTL = 730 * 24 * 3600; // 2 years

function prefsKey(wallet: string) { return `user_prefs:${wallet}`; }

export async function GET(req: NextRequest) {
  const wallet = new URL(req.url).searchParams.get('wallet')?.trim();
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });
  const prefs = await redis.get<{ country: string }>(prefsKey(wallet));
  return NextResponse.json({ country: prefs?.country ?? null });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { wallet?: string; country?: string };
    const { wallet, country } = body;
    if (!wallet || !country) {
      return NextResponse.json({ error: 'wallet and country required' }, { status: 400 });
    }
    await redis.set(prefsKey(wallet), { country }, { ex: TTL });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
