import { createHash } from 'crypto';
import { EXPLORER_BASE, LAMPORTS_PER_SOL, SOLANA_CLUSTER } from '@/lib/constants';
import type { AttestationPayloadInput } from '@/types';

export function generateTradeId(): { hex: string; bytes: Uint8Array } {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  const hex = Buffer.from(bytes).toString('hex');
  return { hex, bytes };
}

export function lamportsToSol(lamports: bigint): string {
  const whole = lamports / LAMPORTS_PER_SOL;
  const frac = lamports % LAMPORTS_PER_SOL;
  const fracStr = frac.toString().padStart(9, '0').replace(/0+$/, '') || '0';
  return `${whole}.${fracStr}`;
}

export function solToLamports(sol: number): bigint {
  return BigInt(Math.round(sol * 1_000_000_000));
}

export function paisaToInr(paisa: bigint | number): string {
  const p = typeof paisa === 'bigint' ? Number(paisa) : paisa;
  return (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function txExplorerUrl(sig: string): string {
  return `${EXPLORER_BASE}/tx/${sig}?cluster=${SOLANA_CLUSTER}`;
}

export function accountExplorerUrl(pubkey: string): string {
  return `${EXPLORER_BASE}/address/${pubkey}?cluster=${SOLANA_CLUSTER}`;
}

export function formatAddress(addr: string, chars = 8): string {
  if (addr.length <= chars * 2) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-4)}`;
}

export function sha256(input: Buffer | Uint8Array): Buffer {
  return createHash('sha256').update(input).digest();
}

// Layout: trade_id(32) + inr_amount(8BE) + payer_hash(32) + payee_hash(32) + timestamp(8BE) + expires_at(8BE) + evidence_hash(32) + risk_score(8BE) = 160 bytes
export function buildAttestationMessage(
  tradeId: Uint8Array,
  p: AttestationPayloadInput,
): Buffer {
  const buf = Buffer.alloc(160);
  let off = 0;
  Buffer.from(tradeId).copy(buf, off);          off += 32;
  buf.writeBigUInt64BE(p.inrAmount, off);        off += 8;
  Buffer.from(p.payerHash).copy(buf, off);       off += 32;
  Buffer.from(p.payeeHash).copy(buf, off);       off += 32;
  buf.writeBigUInt64BE(p.timestamp, off);        off += 8;
  buf.writeBigUInt64BE(p.expiresAt, off);        off += 8;
  Buffer.from(p.evidenceHash).copy(buf, off);    off += 32;
  buf.writeBigUInt64BE(BigInt(p.riskScore), off);
  return buf;
}

/** Compute Anchor instruction discriminator: SHA256("global:<snake_name>")[0..8] */
export function instructionDiscriminator(snakeName: string): Buffer {
  return sha256(Buffer.from(`global:${snakeName}`)).slice(0, 8);
}

/** Compute Anchor account discriminator: SHA256("account:<PascalName>")[0..8] */
export function accountDiscriminator(pascalName: string): Buffer {
  return sha256(Buffer.from(`account:${pascalName}`)).slice(0, 8);
}
