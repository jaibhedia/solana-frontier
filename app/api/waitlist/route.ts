import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const TABLE = (process.env.SUPABASE_WAITLIST_TABLE ?? 'waitlist_submissions').trim();

const MAX = { company: 200, role: 120, telegram: 120, discord: 120, utm: 120 } as const;

const buckets = new Map<string, number[]>();
function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const arr = (buckets.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (arr.length >= 20) return false;
  arr.push(now);
  buckets.set(ip, arr);
  return true;
}

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 5 || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function optionalField(raw: unknown, maxLen: number): string | null {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string') throw new Error('INVALID_FIELD');
  const s = raw.trim();
  if (!s) return null;
  if (s.length > maxLen) throw new Error('TOO_LONG');
  return s;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase.from(TABLE).select('*', { count: 'exact', head: true });
    if (error) return NextResponse.json({ count: 0 });
    return NextResponse.json({ count: count ?? 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (!rateLimitOk(ip)) {
      return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const email = normalizeEmail(body.email);
    if (!email) {
      return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
    }

    let company: string | null, role: string | null, telegram_handle: string | null;
    let discord_handle: string | null, utm_source: string | null;
    let utm_medium: string | null, utm_campaign: string | null;

    try {
      company         = optionalField(body.company,                            MAX.company);
      role            = optionalField(body.role,                               MAX.role);
      telegram_handle = optionalField(body.telegram,                           MAX.telegram);
      discord_handle  = optionalField(body.discordHandle ?? body.discord_handle, MAX.discord);
      utm_source      = optionalField(body.utm_source,                         MAX.utm);
      utm_medium      = optionalField(body.utm_medium,                         MAX.utm);
      utm_campaign    = optionalField(body.utm_campaign,                       MAX.utm);
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid fields' }, { status: 400 });
    }

    const row = {
      email,
      ...(company         != null && { company }),
      ...(role            != null && { role }),
      ...(telegram_handle != null && { telegram_handle }),
      ...(discord_handle  != null && { discord_handle }),
      ...(utm_source      != null && { utm_source }),
      ...(utm_medium      != null && { utm_medium }),
      ...(utm_campaign    != null && { utm_campaign }),
    };

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from(TABLE).insert(row);

    if (error) {
      if (error.code === '23505') {
        const { count } = await supabase.from(TABLE).select('*', { count: 'exact', head: true });
        return NextResponse.json({ ok: true, alreadyOnList: true, position: count ?? 1 });
      }
      console.error('[waitlist]', error.message);
      return NextResponse.json({ ok: false, error: 'Could not save signup' }, { status: 500 });
    }

    const { count } = await supabase.from(TABLE).select('*', { count: 'exact', head: true });
    return NextResponse.json({ ok: true, position: count ?? 1 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Supabase not configured')) {
      return NextResponse.json({ ok: false, error: 'Waitlist not configured' }, { status: 503 });
    }
    console.error('[waitlist POST]', e);
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }
}
