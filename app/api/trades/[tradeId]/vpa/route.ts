import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

const key = (tradeId: string) => `vpa:${tradeId}`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ tradeId: string }> }) {
  try {
    const { tradeId } = await params;
    const body = (await req.json()) as { vpa?: string };
    const vpa = (body.vpa ?? '').trim();
    if (!vpa) return NextResponse.json({ error: 'vpa required' }, { status: 400 });
    await redis.set(key(tradeId), vpa, { ex: 60 * 60 * 24 * 7 }); // 7 days
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tradeId: string }> }) {
  const { tradeId } = await params;
  const raw = await redis.get(key(tradeId));
  if (!raw) return NextResponse.json({ error: 'not found' }, { status: 404 });
  // Upstash auto-parses JSON; coerce back to string in case it returned a parsed object
  const vpa = typeof raw === 'string' ? raw : JSON.stringify(raw);
  return NextResponse.json({ vpa });
}
