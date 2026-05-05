import { NextRequest, NextResponse } from 'next/server';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  Ed25519Program,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import bs58 from 'bs58';
import {
  getTrade,
  findTradePda,
  findVaultPda,
  findOracleConfigPda,
  findAttestationRecordPda,
  releaseWithAttestationIx,
} from '@/lib/solana/program';
import { buildAttestationMessage, sha256 } from '@/lib/solana/utils';
import { SOLANA_RPC, ORACLE_PUBKEY_HEX } from '@/lib/constants';
import type { OracleAttestationResponse } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type ReleaseBody = {
  tradeId: string;
  payerId?: string;
  payeeId?: string;
  consentId?: string;
  sessionId?: string;
  utrNumber?: string;
  evidenceHash?: string;
};

function loadOracleKeypair(): Keypair {
  const b58 = (process.env.ORACLE_SECRET_KEY ?? '').trim();
  if (!b58) throw new Error('ORACLE_SECRET_KEY not set');
  const sk = bs58.decode(b58);
  if (sk.length !== 64) throw new Error('ORACLE_SECRET_KEY must be a 64-byte Solana keypair (base58)');
  return Keypair.fromSecretKey(sk);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ReleaseBody;
    const tradeIdHex = (body.tradeId ?? '').replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(tradeIdHex)) {
      return NextResponse.json({ error: 'tradeId must be 64-char hex' }, { status: 400 });
    }
    const tradeIdBytes = Buffer.from(tradeIdHex, 'hex');

    const connection = new Connection(SOLANA_RPC, 'confirmed');
    const trade = await getTrade(connection, tradeIdBytes);
    if (!trade) return NextResponse.json({ error: 'Trade not found on-chain' }, { status: 404 });
    if (trade.status !== 1) return NextResponse.json({ error: `Trade not active (status=${trade.status})` }, { status: 409 });

    // Get oracle attestation by calling /api/attest on the same host (Setu verification + signing).
    // Use the incoming request's origin so it works on localhost, Vercel previews, and prod alike.
    const origin = new URL(req.url).origin;
    const attestHttp = await fetch(`${origin}/api/attest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tradeId: tradeIdHex,
        inrAmount: String(trade.inrAmount),
        payerId: body.payerId ?? 'buyer@upi',
        payeeId: body.payeeId ?? 'seller@upi',
        evidenceHash: body.evidenceHash ?? body.utrNumber,
        utrNumber: body.utrNumber,
        ...(body.consentId ? { consentId: body.consentId } : {}),
        ...(body.sessionId ? { sessionId: body.sessionId } : {}),
      }),
    });
    if (!attestHttp.ok) {
      const errBody = await attestHttp.json().catch(() => ({ error: attestHttp.statusText }));
      return NextResponse.json({ error: `Attestation failed: ${errBody.error ?? attestHttp.statusText}` }, { status: attestHttp.status });
    }
    const attestRes = (await attestHttp.json()) as OracleAttestationResponse;

    const attestation = attestRes.attestation;
    const oraclePubkeyHex = attestRes.oraclePubkey ?? ORACLE_PUBKEY_HEX;

    // Build the same Ed25519 + program ix that the frontend used to build,
    // but with the oracle keypair as the tx payer (the program does NOT require buyer to sign).
    const message = buildAttestationMessage(tradeIdBytes, {
      inrAmount: BigInt(attestation.inrAmount),
      payerHash: Buffer.from(attestation.payerHash, 'hex'),
      payeeHash: Buffer.from(attestation.payeeHash, 'hex'),
      timestamp: BigInt(attestation.timestamp),
      expiresAt: BigInt(attestation.expiresAt),
      evidenceHash: Buffer.from(attestation.evidenceHash, 'hex'),
      riskScore: attestation.riskScore,
    });
    const digest = sha256(message);

    const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
      publicKey: Buffer.from(oraclePubkeyHex, 'hex'),
      message: digest,
      signature: Buffer.from(attestation.signature, 'hex'),
    });

    const oracleKp = loadOracleKeypair();
    const [tradePda] = findTradePda(tradeIdBytes);
    const [vaultPda] = findVaultPda(tradeIdBytes);
    const [oracleConfigPda] = findOracleConfigPda();
    const [attRecordPda] = findAttestationRecordPda(tradeIdBytes);
    const buyerPubkey = new PublicKey(trade.buyer);

    const programIx = releaseWithAttestationIx(
      oracleKp.publicKey, tradePda, vaultPda, buyerPubkey, attRecordPda, oracleConfigPda,
      0, attestation,
    );

    // Fund oracle on devnet if needed — it's the fee payer and must have SOL
    const oracleBalance = await connection.getBalance(oracleKp.publicKey);
    if (oracleBalance < 0.05 * LAMPORTS_PER_SOL) {
      try {
        const airdropSig = await connection.requestAirdrop(oracleKp.publicKey, LAMPORTS_PER_SOL);
        await connection.confirmTransaction(airdropSig, 'confirmed');
      } catch (e) {
        console.warn('[release] airdrop failed (balance may still be ok):', (e as Error).message);
      }
    }

    const tx = new Transaction().add(ed25519Ix).add(programIx);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = oracleKp.publicKey;
    tx.sign(oracleKp);

    const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

    return NextResponse.json({ signature });
  } catch (e) {
    console.error('[release]', e);
    return NextResponse.json({ error: (e as Error).message ?? 'Internal error' }, { status: 500 });
  }
}
