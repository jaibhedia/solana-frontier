import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    programId:      process.env.NEXT_PUBLIC_PROGRAM_ID        ?? null,
    oraclePubkey:   process.env.NEXT_PUBLIC_ORACLE_PUBKEY_HEX ?? null,
    solanaRpc:      process.env.NEXT_PUBLIC_SOLANA_RPC_URL     ?? 'https://api.devnet.solana.com',
    verificationMode: (process.env.VERIFICATION_MODE ?? 'mock').toLowerCase(),
    appVersion:     process.env.NEXT_PUBLIC_APP_VERSION        ?? 'v0.9.2',
  });
}
