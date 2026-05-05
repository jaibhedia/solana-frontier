import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

type Proof = { buyerVpa: string; utrNumber: string; setuVerified: boolean; submittedAt: number };

const key = (tradeId: string) => `proof:${tradeId}`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ tradeId: string }> }) {
  try {
    const { tradeId } = await params;
    const body = (await req.json()) as { buyerVpa?: string; utrNumber?: string; setuVerified?: boolean };
    if (!body.buyerVpa || !body.utrNumber) {
      return NextResponse.json({ error: 'buyerVpa and utrNumber required' }, { status: 400 });
    }
    const proof: Proof = {
      buyerVpa: body.buyerVpa,
      utrNumber: body.utrNumber,
      setuVerified: body.setuVerified === true,
      submittedAt: Date.now(),
    };
    await redis.set(key(tradeId), JSON.stringify(proof), { ex: 60 * 60 * 24 * 7 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tradeId: string }> }) {
  const { tradeId } = await params;
  const raw = await redis.get<string>(key(tradeId));
  if (!raw) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const proof: Proof = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return NextResponse.json(proof);
}
