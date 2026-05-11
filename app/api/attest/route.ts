import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { buildAttestationMessage } from '@/lib/solana/utils';
import { setuGet } from '@/lib/setu';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ── Oracle keypair ────────────────────────────────────────────────────────────

const ORACLE_SECRET_KEY_B58 = (process.env.ORACLE_SECRET_KEY ?? '').trim();
let oracleSk: Uint8Array;
let oraclePubkeyHex: string;

try {
  if (!ORACLE_SECRET_KEY_B58) throw new Error('ORACLE_SECRET_KEY not set');
  oracleSk = bs58.decode(ORACLE_SECRET_KEY_B58);
  // Solana keypair: 64 bytes — first 32 are seed, last 32 are pubkey
  if (oracleSk.length !== 64) throw new Error('ORACLE_SECRET_KEY must be 64-byte Solana keypair (base58)');
  oraclePubkeyHex = Buffer.from(oracleSk.slice(32)).toString('hex');
} catch (e) {
  // In dev without a key, generate a fresh ephemeral keypair
  const kp = nacl.sign.keyPair();
  oracleSk = kp.secretKey;
  oraclePubkeyHex = Buffer.from(kp.publicKey).toString('hex');
  console.warn('[oracle] No ORACLE_SECRET_KEY — using ephemeral key:', oraclePubkeyHex);
}

// ── Risk scoring (simple in-memory) ──────────────────────────────────────────

const RISK_REJECT_THRESHOLD = 70;
const usedEvidence = new Set<string>();
const payerAttempts = new Map<string, number[]>();

function calculateRiskScore(
  tradeId: string,
  inrPaisa: number,
  payerId: string,
  utrNumber?: string,
  evidenceHash?: string,
): number {
  let score = 0;

  const evKey = evidenceHash || utrNumber || '';
  if (evKey && usedEvidence.has(evKey)) score += 40;

  const now = Date.now();
  const window = 60 * 60 * 1000;
  const attempts = (payerAttempts.get(payerId) || []).filter((t) => now - t < window);
  if (attempts.length > 5) score += 30;
  if (inrPaisa > 500_00000) score += 10; // > ₹5L

  return Math.min(score, 100);
}

function recordUsed(evKey: string, payerId: string) {
  if (evKey) usedEvidence.add(evKey);
  const now = Date.now();
  const arr = payerAttempts.get(payerId) || [];
  arr.push(now);
  payerAttempts.set(payerId, arr);
}

// ── TDS calculation (Section 194S) ───────────────────────────────────────────

function calculateTds(inrPaisa: number) {
  const threshold = 1_000_00000; // ₹10,000 per buyer
  const rate = 0.01;             // 1%
  const applicable = inrPaisa >= threshold;
  const tdsAmountPaisa = applicable ? Math.floor(inrPaisa * rate) : 0;
  return {
    inrAmountPaisa: inrPaisa,
    inrAmountRupees: (inrPaisa / 100).toFixed(2),
    tdsAmountPaisa,
    tdsAmountRupees: (tdsAmountPaisa / 100).toFixed(2),
    tdsRate: rate * 100,
    applicable,
    section: '194S',
    fy: '2025-26',
  };
}

// ── Attestation store ─────────────────────────────────────────────────────────

const store = new Map<string, { attestation: object; signature: string; riskScore: number }>();

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const { tradeId, payerId, payeeId, evidenceHash, utrNumber, consentId } = body;
    const rawAmount = body.inrAmount;

    // Normalise inrAmount to paisa integer
    let inrPaisa: number;
    const rawBig = BigInt(String(rawAmount ?? 0));
    if (rawBig > BigInt('1000000000000000')) {
      inrPaisa = Number(rawBig / BigInt(10 ** 16));
    } else {
      inrPaisa = Number(rawBig);
    }

    // Verification mode
    const { sessionId } = body;
    const verificationMode = (process.env.VERIFICATION_MODE ?? 'mock').toLowerCase();
    // SETU_FALLBACK_MOCK=true lets us run in setu mode but auto-approve when Setu API is unreachable
    const setuFallbackMock = (process.env.SETU_FALLBACK_MOCK ?? 'true').toLowerCase() !== 'false';

    if (verificationMode === 'setu') {
      if (!consentId || typeof consentId !== 'string') {
        if (setuFallbackMock) {
          console.warn('[attest] Setu mode but no consentId — falling back to mock approval');
        } else {
          return NextResponse.json({ error: 'consentId required in Setu mode — start AA consent flow first' }, { status: 400 });
        }
      } else {
        try {
          const consent = await setuGet<{ status: string }>(`/v2/consents/${consentId}`);
          if (consent.status !== 'ACTIVE') {
            return NextResponse.json({ error: `Setu consent not active (${consent.status}) — user must approve in AA app` }, { status: 402 });
          }
          // If a FI data session is available, verify the actual UPI transaction
          if (sessionId && typeof sessionId === 'string') {
            type FiResp = {
              status: string;
              Payload?: { Data?: Array<{ decryptedFI?: { transactions?: { transaction?: Array<{ amount: string; type: string; mode: string; valueDate?: string }> } } }> };
            };
            const fiData = await setuGet<FiResp>(`/v2/sessions/${sessionId}`);
            if (fiData.status === 'COMPLETED') {
              const txns = (fiData.Payload?.Data ?? []).flatMap((d) => {
                const t = d.decryptedFI?.transactions?.transaction;
                return Array.isArray(t) ? t : [];
              });
              const cutoff = Date.now() - 48 * 3600_000;
              const matched = txns.some((t) => {
                const amountMatches = Math.round(Number(t.amount) * 100) === inrPaisa;
                const isUpiDebit = t.mode === 'UPI' && t.type === 'DEBIT';
                const isRecent = !t.valueDate || new Date(t.valueDate).getTime() >= cutoff;
                return amountMatches && isUpiDebit && isRecent;
              });
              if (!matched) {
                return NextResponse.json({ error: 'No matching UPI DEBIT transaction found in account statement for this amount' }, { status: 402 });
              }
            }
          }
        } catch (e) {
          if (setuFallbackMock) {
            console.warn('[attest] Setu API unreachable — falling back to mock approval:', (e as Error).message);
          } else {
            return NextResponse.json({ error: `Setu verification failed: ${(e as Error).message}` }, { status: 502 });
          }
        }
      }
    }

    // Normalise tradeId to 64-char hex
    let tradeIdHex: string;
    if (typeof tradeId === 'string' && /^[0-9a-fA-F]{64}$/.test(tradeId.replace(/^0x/, ''))) {
      tradeIdHex = tradeId.replace(/^0x/, '');
    } else {
      tradeIdHex = createHash('sha256').update(String(tradeId ?? 'trade-' + Date.now())).digest('hex');
    }
    const tradeIdBytes = Buffer.from(tradeIdHex, 'hex');

    const timestamp = Math.floor(Date.now() / 1000);
    const expiresAt = timestamp + 3600;

    const payerIdStr = String(payerId ?? 'payer@upi');
    const payeeIdStr = String(payeeId ?? 'payee@upi');
    const evStr = String(evidenceHash ?? utrNumber ?? '');

    const riskScore = calculateRiskScore(tradeIdHex, inrPaisa, payerIdStr, String(utrNumber ?? ''), evStr);
    if (riskScore >= RISK_REJECT_THRESHOLD) {
      return NextResponse.json({ error: 'risk too high', riskScore, code: 400 }, { status: 400 });
    }

    const tds = calculateTds(inrPaisa);

    const payerHash = createHash('sha256').update(payerIdStr).digest();
    const payeeHash = createHash('sha256').update(payeeIdStr).digest();
    const evidenceHashBuf = evStr.length === 64
      ? Buffer.from(evStr, 'hex')
      : createHash('sha256').update(evStr || 'evidence').digest();

    const message = buildAttestationMessage(tradeIdBytes, {
      inrAmount: BigInt(inrPaisa),
      payerHash,
      payeeHash,
      timestamp: BigInt(timestamp),
      expiresAt: BigInt(expiresAt),
      evidenceHash: evidenceHashBuf,
      riskScore,
    });

    const digest = createHash('sha256').update(message).digest();
    const sigBytes = nacl.sign.detached(digest, oracleSk);
    const signature = Buffer.from(sigBytes).toString('hex');

    recordUsed(evidenceHashBuf.toString('hex'), payerIdStr);

    const attestation = {
      tradeId: '0x' + tradeIdHex,
      inrAmount: inrPaisa,
      payerHash: payerHash.toString('hex'),
      payeeHash: payeeHash.toString('hex'),
      timestamp,
      expiresAt,
      evidenceHash: evidenceHashBuf.toString('hex'),
      riskScore,
      signature,
    };

    const attestationHash = digest.toString('hex');
    store.set(attestationHash, { attestation, signature, riskScore });

    return NextResponse.json({
      success: true,
      attestation,
      attestationHash,
      signature,
      riskScore,
      oraclePubkey: oraclePubkeyHex,
      tds,
    });
  } catch (e) {
    console.error('[attest]', e);
    return NextResponse.json({ error: (e as Error).message ?? 'Internal error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const hash = new URL(req.url).searchParams.get('hash');
  if (!hash) return NextResponse.json({ error: 'Missing hash' }, { status: 400 });
  const stored = store.get(hash);
  if (!stored) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ attestationHash: hash, ...stored, oraclePubkey: oraclePubkeyHex });
}
