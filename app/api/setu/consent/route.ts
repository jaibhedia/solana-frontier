import { NextRequest, NextResponse } from 'next/server';
import { setuPost, buildConsentBody, consentWebviewUrl } from '@/lib/setu';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const setuFallbackMock = (process.env.SETU_FALLBACK_MOCK ?? 'true').toLowerCase() !== 'false';

type ConsentResp = { id: string; url?: string; status: string };

function resolveRedirectUrl(raw: string | undefined): string {
  const vercelHost = process.env.VERCEL_URL?.trim();
  const vercelBase =
    vercelHost && (vercelHost.startsWith('http://') || vercelHost.startsWith('https://'))
      ? vercelHost
      : vercelHost
        ? `https://${vercelHost}`
        : '';
  const fallback =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    vercelBase ||
    'http://localhost:3000';
  const candidate = (typeof raw === 'string' && raw.trim()) ? raw.trim() : fallback;
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return fallback;
    return u.toString();
  } catch {
    return fallback;
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try {
    body = (await req.json()) as Record<string, string>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { aaId, redirectUrl } = body;
  if (!aaId) {
    return NextResponse.json({ error: 'aaId required (e.g. 9999999999@onemoney)' }, { status: 400 });
  }

  const now = Date.now();
  const fromDate = new Date(now - 30 * 86400_000).toISOString().slice(0, 10) + 'T00:00:00.000Z';
  const toDate   = new Date(now).toISOString();
  const redirect = resolveRedirectUrl(redirectUrl);

  try {
    const result = await setuPost<ConsentResp>('/v2/consents', buildConsentBody({
      aaId,
      fromDate,
      toDate,
      redirectUrl: redirect,
    }));
    const url = (result.url && String(result.url).trim()) || consentWebviewUrl(result.id, redirect);
    return NextResponse.json({ ...result, url });
  } catch (e) {
    console.error('[setu/consent]', e);
    if (setuFallbackMock) {
      console.warn('[setu/consent] Setu unreachable — using mock consent flow');
      const mockId = `mock_${now}`;
      let mockUrl: string;
      try {
        const u = new URL(redirect);
        u.searchParams.set('id', mockId);
        mockUrl = u.toString();
      } catch {
        mockUrl = `${redirect}?id=${mockId}`;
      }
      return NextResponse.json({ id: mockId, url: mockUrl, status: 'PENDING' });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
