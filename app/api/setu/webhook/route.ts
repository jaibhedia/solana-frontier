import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// In-memory store — survives across requests in the same serverless instance.
// For multi-instance deployments use Supabase/Redis instead.
const webhookStore = new Map<string, { consentStatus: string; fiStatus?: string; updatedAt: number }>();

type WebhookBody = {
  type: 'CONSENT_STATUS_UPDATE' | 'FI_STATUS_UPDATE' | string;
  consentId: string;
  timestamp: string;
  success: boolean;
  data: {
    status: string;
  };
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WebhookBody;
    console.log('[setu/webhook]', body.type, body.consentId, body.data?.status);

    const entry = webhookStore.get(body.consentId) ?? { consentStatus: 'PENDING', updatedAt: 0 };

    if (body.type === 'CONSENT_STATUS_UPDATE') {
      entry.consentStatus = body.data.status;
      entry.updatedAt = Date.now();
      webhookStore.set(body.consentId, entry);
    } else if (body.type === 'FI_STATUS_UPDATE') {
      entry.fiStatus = body.data.status;
      entry.updatedAt = Date.now();
      webhookStore.set(body.consentId, entry);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[setu/webhook]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// Allow Setu to check the webhook is reachable
export async function GET() {
  return NextResponse.json({ ok: true, entries: webhookStore.size });
}
