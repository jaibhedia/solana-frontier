import { NextResponse } from 'next/server';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

export const dynamic = 'force-dynamic';

const startTime = Date.now();

function getOraclePubkeyHex(): string {
  const sk = process.env.ORACLE_SECRET_KEY?.trim();
  if (sk) {
    try {
      const decoded = bs58.decode(sk);
      if (decoded.length === 64) return Buffer.from(decoded.slice(32)).toString('hex');
    } catch {}
  }
  return process.env.NEXT_PUBLIC_ORACLE_PUBKEY_HEX ?? 'not-configured';
}

export async function GET() {
  const uptime = Date.now() - startTime;
  return NextResponse.json({
    status: 'ok',
    chain: 'solana',
    network: process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes('devnet') ? 'devnet' : 'mainnet',
    programId: process.env.NEXT_PUBLIC_PROGRAM_ID ?? 'not-configured',
    oraclePubkey: getOraclePubkeyHex(),
    verificationMode: (process.env.VERIFICATION_MODE ?? 'mock').toLowerCase(),
    uptime: { ms: uptime, human: formatUptime(uptime) },
  });
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
