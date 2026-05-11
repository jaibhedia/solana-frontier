import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { PROGRAM_ID_STR, SOLANA_RPC, TRADE_STATUS } from '@/lib/constants';
import { accountDiscriminator } from '@/lib/solana/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROGRAM_ID = new PublicKey(PROGRAM_ID_STR);

function readU64LE(buf: Buffer, off: number): bigint {
  const lo = BigInt(buf.readUInt32LE(off));
  const hi = BigInt(buf.readUInt32LE(off + 4));
  return (hi << 32n) | lo;
}
function readI64LE(buf: Buffer, off: number): bigint {
  const u = readU64LE(buf, off);
  return u >= (1n << 63n) ? u - (1n << 64n) : u;
}

// Trade layout (after 8-byte discriminator):
// trade_id:        [u8;32]   @ 8
// seller:          Pubkey    @ 40
// buyer:           Pubkey    @ 72
// lamports:        u64 LE    @ 104
// inr_amount:      u64 LE    @ 112
// payee_vpa_hash:  [u8;32]   @ 120
// deadline:        i64 LE    @ 152
// status:          u8        @ 160
// bump:            u8        @ 161
// vault_bump:      u8        @ 162
// created_at:      i64 LE    @ 163
// released_at:     i64 LE    @ 171
function decodeTrade(pubkey: string, data: Buffer) {
  if (data.length < 179) return null;
  const tradeId    = data.slice(8, 40).toString('hex');
  const seller     = new PublicKey(data.slice(40, 72)).toBase58();
  const buyer      = new PublicKey(data.slice(72, 104)).toBase58();
  const lamports   = readU64LE(data, 104);
  const inrAmount  = readU64LE(data, 112);
  const deadline   = readI64LE(data, 152);
  const status     = data[160];
  const createdAt  = readI64LE(data, 163);
  const releasedAt = readI64LE(data, 171);
  return {
    pubkey,
    tradeId,
    seller,
    buyer,
    lamports:   lamports.toString(),
    inrAmount:  inrAmount.toString(),
    deadline:   Number(deadline),
    status,
    statusLabel: TRADE_STATUS[status] ?? 'Unknown',
    createdAt:  Number(createdAt),
    releasedAt: Number(releasedAt),
  };
}

export async function GET() {
  try {
    const connection  = new Connection(SOLANA_RPC, 'confirmed');
    const disc        = accountDiscriminator('Trade');
    const accounts    = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 0, bytes: disc.toString('base64'), encoding: 'base64' } },
      ],
    });

    const trades = accounts
      .map(({ pubkey, account }) => decodeTrade(pubkey.toBase58(), Buffer.from(account.data)))
      .filter(Boolean)
      .sort((a, b) => b!.createdAt - a!.createdAt)
      .slice(0, 50);

    return NextResponse.json({ trades, total: accounts.length });
  } catch (e) {
    console.error('[api/trades]', e);
    return NextResponse.json({ trades: [], total: 0 });
  }
}
