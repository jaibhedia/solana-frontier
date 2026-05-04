import { NextRequest, NextResponse } from 'next/server';
import { setuPost, buildConsentBody } from '@/lib/setu';

export const dynamic = 'force-dynamic';

type ConsentResp = { id: string; url: string; status: string };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, string>;
    const { aaId, redirectUrl } = body;

    if (!aaId) {
      return NextResponse.json({ error: 'aaId required (e.g. 9999999999@onemoney)' }, { status: 400 });
    }

    const now = Date.now();
    const fromDate = new Date(now - 30 * 86400_000).toISOString().slice(0, 10) + 'T00:00:00.000Z';
    const toDate   = new Date(now).toISOString();

    const result = await setuPost<ConsentResp>('/v2/consents', buildConsentBody({
      aaId,
      fromDate,
      toDate,
    }));

    return NextResponse.json(result);
  } catch (e) {
    console.error('[setu/consent]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
