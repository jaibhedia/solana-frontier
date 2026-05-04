import type { OracleAttestationResponse, OracleRate } from '@/types';

export type AttestationRequestPayload = {
  tradeId: string;
  inrAmount: string | number;
  payerId?: string;
  payeeId?: string;
  evidenceHash?: string;
  utrNumber?: string;
  consentId?: string;
  sessionId?: string;
};

function apiBase(): string {
  if (typeof window !== 'undefined') return '';
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';
}

export async function requestAttestation(
  payload: AttestationRequestPayload,
): Promise<OracleAttestationResponse> {
  const res = await fetch(`${apiBase()}/api/attest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Attestation failed');
  }
  return res.json() as Promise<OracleAttestationResponse>;
}

export async function getRate(): Promise<OracleRate> {
  const res = await fetch(`${apiBase()}/api/rate`);
  if (!res.ok) throw new Error('Rate unavailable');
  return res.json() as Promise<OracleRate>;
}

export async function checkOracleHealth(): Promise<{ status: string; oraclePubkey: string }> {
  const res = await fetch(`${apiBase()}/api/health`);
  if (!res.ok) throw new Error('Oracle unavailable');
  return res.json();
}
