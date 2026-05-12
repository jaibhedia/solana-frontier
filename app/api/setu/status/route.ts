import { NextRequest, NextResponse } from 'next/server';
import { setuGet, setuPost } from '@/lib/setu';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type ConsentResp = { status: string };
type SessionResp = { id: string; status: string };

export async function GET(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    if (id.startsWith('mock_')) {
      return NextResponse.json({ status: 'ACTIVE', ready: true });
    }

    const consent = await setuGet<ConsentResp>(`/v2/consents/${id}`);

    if (consent.status !== 'ACTIVE') {
      return NextResponse.json({ status: consent.status, ready: false });
    }

    // Consent is ACTIVE — try to start FI data session (24h window, always within consent range)
    const now = Date.now();
    let sessionId: string | undefined;
    try {
      const session = await setuPost<SessionResp>('/v2/data-sessions', {
        consentId: id,
        DataRange: {
          from: new Date(now - 24 * 3600_000).toISOString(),
          to:   new Date(now).toISOString(),
        },
        format: 'json',
      });
      sessionId = session.id;
    } catch (e) {
      console.warn('[setu/status] FI session start failed (non-fatal):', (e as Error).message);
    }

    return NextResponse.json({ status: 'ACTIVE', ready: true, sessionId });
  } catch (e) {
    console.error('[setu/status]', e);
    const setuFallbackMock = (process.env.SETU_FALLBACK_MOCK ?? 'true').toLowerCase() !== 'false';
    if (setuFallbackMock) {
      console.warn('[setu/status] Setu unreachable — mock ACTIVE');
      return NextResponse.json({ status: 'ACTIVE', ready: true });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
