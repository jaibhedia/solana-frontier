import { NextRequest, NextResponse } from 'next/server';
import { setuPost, buildConsentBody, consentWebviewUrl } from '@/lib/setu';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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
  try {
    const body = (await req.json()) as Record<string, string>;
    const { aaId, redirectUrl } = body;

    if (!aaId) {
      return NextResponse.json({ error: 'aaId required (e.g. 9999999999@onemoney)' }, { status: 400 });
    }

    const now = Date.now();
    const fromDate = new Date(now - 30 * 86400_000).toISOString().slice(0, 10) + 'T00:00:00.000Z';
    const toDate   = new Date(now).toISOString();

    const redirect = resolveRedirectUrl(redirectUrl);

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
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
