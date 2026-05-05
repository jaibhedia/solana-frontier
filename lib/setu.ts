const TOKEN_URL  = process.env.SETU_TOKEN_URL!;
const CLIENT_ID  = process.env.SETU_CLIENT_ID!;
const CLIENT_SEC = process.env.SETU_CLIENT_SECRET!;
const FIU_BASE   = process.env.SETU_FIU_BASE_URL!;
const PRODUCT_ID = process.env.SETU_PRODUCT_INSTANCE_ID!;

let _tok: { token: string; exp: number } | null = null;

export async function setuToken(): Promise<string> {
  if (_tok && Date.now() < _tok.exp) return _tok.token;
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'client': 'bridge' },
    body: JSON.stringify({ clientID: CLIENT_ID, secret: CLIENT_SEC, grant_type: 'client_credentials' }),
  });
  if (!r.ok) throw new Error(`Setu auth failed ${r.status}: ${await r.text()}`);
  const d = await r.json() as Record<string, unknown>;
  const token = (d?.data as Record<string, unknown>)?.token as string
    || d?.token as string
    || d?.accessToken as string
    || d?.access_token as string;
  if (!token) throw new Error('Setu token response missing token: ' + JSON.stringify(d));
  const expiresIn = (d?.data as Record<string, unknown>)?.expiresIn as number ?? d?.expiresIn as number ?? 1800;
  _tok = { token, exp: Date.now() + (expiresIn - 60) * 1000 };
  return _tok.token;
}

function setuHeaders(tok: string) {
  return {
    Authorization: `Bearer ${tok}`,
    'Content-Type': 'application/json',
    'x-product-instance-id': PRODUCT_ID,
  };
}

export async function setuPost<T>(path: string, body: unknown): Promise<T> {
  const tok = await setuToken();
  const r = await fetch(`${FIU_BASE}${path}`, {
    method: 'POST',
    headers: setuHeaders(tok),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Setu POST ${path} ${r.status}: ${await r.text()}`);
  return r.json() as Promise<T>;
}

export async function setuGet<T>(path: string): Promise<T> {
  const tok = await setuToken();
  const r = await fetch(`${FIU_BASE}${path}`, {
    headers: setuHeaders(tok),
  });
  if (!r.ok) throw new Error(`Setu GET ${path} ${r.status}: ${await r.text()}`);
  return r.json() as Promise<T>;
}

/** Webview URL for AA consent when Setu omits `url` on create (same pattern as Setu docs). */
export function consentWebviewUrl(consentId: string, redirectUrl?: string): string {
  const base = FIU_BASE.replace(/\/$/, '');
  const webview = `${base}/v2/consents/ui/${consentId}`;
  return redirectUrl ? `${webview}?redirectUrl=${encodeURIComponent(redirectUrl)}` : webview;
}

export function buildConsentBody(params: {
  aaId: string;
  fromDate: string;
  toDate: string;
  redirectUrl: string;
}) {
  return {
    consentDuration: { unit: 'DAY', value: 1 },
    vua: params.aaId,
    dataRange: { from: params.fromDate, to: params.toDate },
    redirectUrl: params.redirectUrl,
    consentMode: 'VIEW',
    fetchType: 'ONETIME',
    consentTypes: ['TRANSACTIONS'],
    fiTypes: ['DEPOSIT'],
    purpose: {
      code: '101',
      refUri: 'https://api.rebit.org.in/aa/purpose/101.xml',
      text: 'Peer-to-peer trade payment verification',
      category: { type: 'PERSONAL_FINANCE' },
    },
    dataLife: { unit: 'MONTH', value: 0 },
    frequency: { unit: 'MONTH', value: 1 },
    context: [],
  };
}
