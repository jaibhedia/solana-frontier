import { NextRequest, NextResponse } from 'next/server';
import { setuGet, setuPost } from '@/lib/setu';

export const dynamic = 'force-dynamic';

type ConsentResp = {
  status: string;
  detail?: { dataRange?: { from: string; to: string } };
};

type SessionResp = {
  id: string;
  status: string;
  Payload?: {
    Data?: Array<{
      decryptedFI?: {
        transactions?: {
          transaction?: UpiTxn[];
        };
      };
    }>;
  };
};

export type UpiTxn = {
  amount: string;
  type: string;
  mode: string;
  narration?: string;
  txnId?: string;
  valueDate?: string;
};

export async function GET(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const consent = await setuGet<ConsentResp>(`/v2/consents/${id}`);

    if (consent.status !== 'ACTIVE') {
      return NextResponse.json({ status: consent.status, ready: false });
    }

    // Consent approved — fetch FI data to verify transactions
    const range = consent.detail?.dataRange ?? {
      from: new Date(Date.now() - 30 * 86400_000).toISOString(),
      to:   new Date().toISOString(),
    };

    const session = await setuPost<SessionResp>('/v2/sessions', {
      consentId: id,
      dataRange: range,
      format: 'json',
    });

    // Brief wait for async FI fetch then poll once
    await new Promise((r) => setTimeout(r, 2000));
    const fiData = await setuGet<SessionResp>(`/v2/sessions/${session.id}`);

    const transactions: UpiTxn[] = (fiData.Payload?.Data ?? []).flatMap((d) => {
      const txns = d.decryptedFI?.transactions?.transaction;
      return Array.isArray(txns) ? txns : [];
    });

    return NextResponse.json({
      status: 'ACTIVE',
      ready:  fiData.status === 'COMPLETED',
      sessionId: session.id,
      fiStatus:  fiData.status,
      transactions,
    });
  } catch (e) {
    console.error('[setu/status]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
