import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

type WebhookEntry = { consentStatus: string; fiStatus?: string; updatedAt: number };
type WebhookBody = {
  type: 'CONSENT_STATUS_UPDATE' | 'FI_STATUS_UPDATE' | string;
  consentId: string;
  timestamp: string;
  success: boolean;
  data: { status: string };
};

const key = (consentId: string) => `setu:consent:${consentId}`;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WebhookBody;
    console.log('[setu/webhook]', body.type, body.consentId, body.data?.status);

    const raw = await redis.get<string>(key(body.consentId));
    const entry: WebhookEntry = raw
      ? (typeof raw === 'string' ? JSON.parse(raw) : raw)
      : { consentStatus: 'PENDING', updatedAt: 0 };

    if (body.type === 'CONSENT_STATUS_UPDATE') {
      entry.consentStatus = body.data.status;
      entry.updatedAt = Date.now();
    } else if (body.type === 'FI_STATUS_UPDATE') {
      entry.fiStatus = body.data.status;
      entry.updatedAt = Date.now();
    }

    await redis.set(key(body.consentId), JSON.stringify(entry), { ex: 60 * 60 * 24 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[setu/webhook]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
