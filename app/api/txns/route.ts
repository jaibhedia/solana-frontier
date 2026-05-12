import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import type { TxnRecord } from '@/types';

export const dynamic = 'force-dynamic';

const TTL_SECONDS = 365 * 24 * 3600;

function txnKey(tradeId: string) { return `txn:${tradeId}`; }
function walletKey(pubkey: string) { return `wallet_txns:${pubkey}`; }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet')?.trim();
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });

  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
  const cursor = searchParams.get('cursor'); // tradeId of last seen record

  let tradeIds: string[];
  if (cursor) {
    const cursorScore = await redis.zscore(walletKey(wallet), cursor);
    if (cursorScore == null) {
      tradeIds = [];
    } else {
      // Fetch records older than cursor (lower score), newest-first
      const raw = await redis.zrange(walletKey(wallet), '-inf', `(${cursorScore}`, {
        byScore: true,
        rev: true,
        offset: 0,
        count: limit,
      });
      tradeIds = raw as string[];
    }
  } else {
    const raw = await redis.zrange(walletKey(wallet), 0, limit - 1, { rev: true });
    tradeIds = raw as string[];
  }

  if (tradeIds.length === 0) return NextResponse.json({ records: [], next: null });

  const records = (await Promise.all(
    tradeIds.map((id) => redis.get<TxnRecord>(txnKey(id))),
  )).filter(Boolean) as TxnRecord[];

  const next = records.length === limit ? records[records.length - 1].tradeId : null;
  return NextResponse.json({ records, next });
}

export async function POST(req: NextRequest) {
  try {
    const record = (await req.json()) as TxnRecord;
    if (!record.tradeId || !record.seller || !record.buyer) {
      return NextResponse.json({ error: 'tradeId, seller, buyer required' }, { status: 400 });
    }

    const pipeline = redis.pipeline();
    pipeline.set(txnKey(record.tradeId), record, { ex: TTL_SECONDS });
    pipeline.zadd(walletKey(record.seller), { score: record.releasedAt, member: record.tradeId });
    pipeline.zadd(walletKey(record.buyer),  { score: record.releasedAt, member: record.tradeId });
    // Extend wallet index TTL on each write
    pipeline.expire(walletKey(record.seller), TTL_SECONDS);
    pipeline.expire(walletKey(record.buyer),  TTL_SECONDS);
    await pipeline.exec();

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[txns POST]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
