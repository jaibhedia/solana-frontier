import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { PROGRAM_ID_STR, SOLANA_RPC } from '@/lib/constants';
import { accountDiscriminator } from '@/lib/solana/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROGRAM_ID = new PublicKey(PROGRAM_ID_STR);

function readU64LE(buf: Buffer, off: number): bigint {
  const lo = BigInt(buf.readUInt32LE(off));
  const hi = BigInt(buf.readUInt32LE(off + 4));
  return (hi << 32n) | lo;
}

function findOracleConfigPda(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('oracle-config')], PROGRAM_ID)[0];
}

// OracleConfig layout (after 8-byte discriminator):
// admin: 32 | oracle_pubkey: 32 | total_trades: u64 LE | total_vol_lamports: u64 LE | bump: 1
function decodeOracleConfig(data: Buffer) {
  if (data.length < 89) throw new Error(`OracleConfig account too short: ${data.length} bytes`);
  const totalTrades      = readU64LE(data, 72);
  const totalVolLamports = readU64LE(data, 80);
  return { totalTrades, totalVolLamports };
}

export async function GET() {
  try {
    const connection = new Connection(SOLANA_RPC, 'confirmed');
    const oraclePda  = findOracleConfigPda();
    const account    = await connection.getAccountInfo(oraclePda);

    if (!account) {
      return NextResponse.json({ totalTrades: 0, totalVolSol: '0', totalVolLamports: '0' });
    }

    const { totalTrades, totalVolLamports } = decodeOracleConfig(Buffer.from(account.data));
    const totalVolSol = (Number(totalVolLamports) / 1e9).toFixed(4);

    return NextResponse.json({
      totalTrades:      Number(totalTrades),
      totalVolSol,
      totalVolLamports: totalVolLamports.toString(),
      oracleConfig:     oraclePda.toBase58(),
    });
  } catch (e) {
    console.error('[api/stats]', e);
    return NextResponse.json({ totalTrades: 0, totalVolSol: '0', totalVolLamports: '0' });
  }
}
