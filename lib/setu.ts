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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientID: CLIENT_ID, secret: CLIENT_SEC }),
  });
  if (!r.ok) throw new Error(`Setu auth failed ${r.status}: ${await r.text()}`);
  const d = (await r.json()) as { accessToken: string; expiresIn?: number };
  _tok = { token: d.accessToken, exp: Date.now() + (d.expiresIn ?? 3600) * 900 };
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

export function buildConsentBody(params: {
  aaId: string;
  fromDate: string;
  toDate: string;
}) {
  return {
    consentDuration: { unit: 'DAY', value: '1' },
    vua: params.aaId,
    dataRange: { from: params.fromDate, to: params.toDate },
    context: [],
  };
}
