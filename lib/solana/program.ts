import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Ed25519Program,
} from '@solana/web3.js';
import { AnchorProvider } from '@coral-xyz/anchor';
import type { AnchorWallet } from '@solana/wallet-adapter-react';
import { createHash } from 'crypto';
import { PROGRAM_ID, ZERO_PUBKEY, LAMPORTS_PER_SOL } from '@/lib/constants';
import {
  instructionDiscriminator,
  accountDiscriminator,
  buildAttestationMessage,
  sha256,
} from './utils';
import type { SolanaTradeInfo, SolanaOracleConfig, OracleAttestationData } from '@/types';

// ─── PDA helpers ──────────────────────────────────────────────────────────────

export function findTradePda(tradeId: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('trade'), tradeId], PROGRAM_ID);
}

export function findVaultPda(tradeId: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('vault'), tradeId], PROGRAM_ID);
}

export function findOracleConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('oracle-config')], PROGRAM_ID);
}

export function findAttestationRecordPda(tradeId: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('att'), tradeId], PROGRAM_ID);
}

// ─── Borsh helpers ────────────────────────────────────────────────────────────

function writeU8(buf: Buffer, off: number, val: number): number {
  buf.writeUInt8(val, off); return off + 1;
}
function writeU64LE(buf: Buffer, off: number, val: bigint): number {
  buf.writeBigUInt64LE(val, off); return off + 8;
}
function writeI64LE(buf: Buffer, off: number, val: bigint): number {
  buf.writeBigInt64LE(val, off); return off + 8;
}
function writeBool(buf: Buffer, off: number, val: boolean): number {
  buf.writeUInt8(val ? 1 : 0, off); return off + 1;
}
function writeBytes32(buf: Buffer, off: number, bytes: Uint8Array): number {
  Buffer.from(bytes).copy(buf, off); return off + 32;
}

// ─── Instruction builders ─────────────────────────────────────────────────────

function createTradeIx(
  seller: PublicKey,
  tradePda: PublicKey,
  vaultPda: PublicKey,
  oracleConfigPda: PublicKey,
  buyer: PublicKey,
  tradeId: Uint8Array,
  lamports: bigint,
  inrAmount: bigint,
  payeeVpaHash: Uint8Array,
  deadlineDelta: bigint,
  isOpenOrder: boolean,
): TransactionInstruction {
  const disc = instructionDiscriminator('create_trade');
  const buf = Buffer.alloc(8 + 32 + 8 + 8 + 32 + 8 + 1);
  let off = disc.copy(buf);
  off = writeBytes32(buf, off, tradeId);
  off = writeU64LE(buf, off, lamports);
  off = writeU64LE(buf, off, inrAmount);
  off = writeBytes32(buf, off, payeeVpaHash);
  off = writeI64LE(buf, off, deadlineDelta);
  writeBool(buf, off, isOpenOrder);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: tradePda,         isSigner: false, isWritable: true },
      { pubkey: vaultPda,         isSigner: false, isWritable: true },
      { pubkey: buyer,            isSigner: false, isWritable: false },
      { pubkey: seller,           isSigner: true,  isWritable: true },
      { pubkey: oracleConfigPda,  isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: buf,
  });
}

function matchOrderIx(
  buyer: PublicKey,
  tradePda: PublicKey,
  tradeId: Uint8Array,
): TransactionInstruction {
  const disc = instructionDiscriminator('match_order');
  const buf = Buffer.alloc(8 + 32);
  disc.copy(buf);
  Buffer.from(tradeId).copy(buf, 8);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: tradePda, isSigner: false, isWritable: true },
      { pubkey: buyer,    isSigner: true,  isWritable: false },
    ],
    data: buf,
  });
}

export function releaseWithAttestationIx(
  payer: PublicKey,
  tradePda: PublicKey,
  vaultPda: PublicKey,
  buyerPubkey: PublicKey,
  attRecordPda: PublicKey,
  oracleConfigPda: PublicKey,
  ed25519IxIndex: number,
  att: OracleAttestationData,
): TransactionInstruction {
  const disc = instructionDiscriminator('release_with_attestation');
  // ed25519IxIndex(1) + inrAmount(8) + payerHash(32) + payeeHash(32)
  // + timestamp(8) + expiresAt(8) + evidenceHash(32) + riskScore(1) = 122 + 8 disc = 130
  const buf = Buffer.alloc(130);
  let off = disc.copy(buf);
  off = writeU8(buf, off, ed25519IxIndex);
  off = writeU64LE(buf, off, BigInt(att.inrAmount));
  off = writeBytes32(buf, off, Buffer.from(att.payerHash, 'hex'));
  off = writeBytes32(buf, off, Buffer.from(att.payeeHash, 'hex'));
  off = writeI64LE(buf, off, BigInt(att.timestamp));
  off = writeI64LE(buf, off, BigInt(att.expiresAt));
  off = writeBytes32(buf, off, Buffer.from(att.evidenceHash, 'hex'));
  writeU8(buf, off, att.riskScore);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: tradePda,                      isSigner: false, isWritable: true },
      { pubkey: vaultPda,                      isSigner: false, isWritable: true },
      { pubkey: buyerPubkey,                   isSigner: false, isWritable: true },
      { pubkey: attRecordPda,                  isSigner: false, isWritable: true },
      { pubkey: oracleConfigPda,               isSigner: false, isWritable: false },
      { pubkey: payer,                         isSigner: true,  isWritable: true },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY,    isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,       isSigner: false, isWritable: false },
    ],
    data: buf,
  });
}

function cancelExpiredIx(
  caller: PublicKey,
  tradePda: PublicKey,
  vaultPda: PublicKey,
  sellerPubkey: PublicKey,
  tradeId: Uint8Array,
): TransactionInstruction {
  const disc = instructionDiscriminator('cancel_expired');
  const buf = Buffer.alloc(8 + 32);
  disc.copy(buf);
  Buffer.from(tradeId).copy(buf, 8);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: tradePda,               isSigner: false, isWritable: true },
      { pubkey: vaultPda,               isSigner: false, isWritable: true },
      { pubkey: sellerPubkey,           isSigner: false, isWritable: true },
      { pubkey: caller,                 isSigner: true,  isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: buf,
  });
}

function disputeIx(
  initiator: PublicKey,
  tradePda: PublicKey,
  tradeId: Uint8Array,
): TransactionInstruction {
  const disc = instructionDiscriminator('dispute');
  const buf = Buffer.alloc(8 + 32);
  disc.copy(buf);
  Buffer.from(tradeId).copy(buf, 8);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: tradePda,  isSigner: false, isWritable: true },
      { pubkey: initiator, isSigner: true,  isWritable: false },
    ],
    data: buf,
  });
}

// ─── Account deserialization ──────────────────────────────────────────────────

function readPublicKey(buf: Buffer, off: number): [string, number] {
  return [new PublicKey(buf.slice(off, off + 32)).toBase58(), off + 32];
}
function readU8(buf: Buffer, off: number): [number, number] {
  return [buf.readUInt8(off), off + 1];
}
function readU64LE(buf: Buffer, off: number): [bigint, number] {
  return [buf.readBigUInt64LE(off), off + 8];
}
function readI64LE(buf: Buffer, off: number): [bigint, number] {
  return [buf.readBigInt64LE(off), off + 8];
}

function deserializeTrade(data: Buffer): SolanaTradeInfo {
  let off = 8; // skip anchor discriminator
  const [tradeId, o1] = [Buffer.from(data.slice(off, off + 32)).toString('hex'), off + 32]; off = o1;
  let seller: string, buyer: string;
  [seller, off] = readPublicKey(data, off);
  [buyer, off] = readPublicKey(data, off);
  let lamports: bigint, inrAmount: bigint, payeeVpaHashHex: string;
  [lamports, off] = readU64LE(data, off);
  [inrAmount, off] = readU64LE(data, off);
  payeeVpaHashHex = Buffer.from(data.slice(off, off + 32)).toString('hex'); off += 32;
  let deadline: bigint;
  [deadline, off] = readI64LE(data, off);
  let status: number;
  [status, off] = readU8(data, off);
  off += 2; // bump, vault_bump
  let createdAt: bigint, releasedAt: bigint;
  [createdAt, off] = readI64LE(data, off);
  [releasedAt] = readI64LE(data, off);
  return { tradeId, seller, buyer, lamports, inrAmount, payeeVpaHash: payeeVpaHashHex, deadline, status, createdAt, releasedAt };
}

function deserializeOracleConfig(data: Buffer): SolanaOracleConfig {
  let off = 8;
  let admin: string, oraclePubkey: string;
  [admin, off] = readPublicKey(data, off);
  [oraclePubkey, off] = readPublicKey(data, off);
  let totalTrades: bigint, totalVolLamports: bigint;
  [totalTrades, off] = readU64LE(data, off);
  [totalVolLamports] = readU64LE(data, off);
  return { admin, oraclePubkey, totalTrades, totalVolLamports };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getAnchorProvider(
  connection: Connection,
  wallet: AnchorWallet,
): AnchorProvider {
  return new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
}

export async function createTrade(
  provider: AnchorProvider,
  params: {
    tradeId: Uint8Array;
    solAmount: number;
    inrAmount: bigint;
    payeeVpaHash: Uint8Array;
    deadlineDelta: number;
    isOpenOrder: boolean;
    buyer?: PublicKey;
  },
): Promise<string> {
  const { tradeId, solAmount, inrAmount, payeeVpaHash, deadlineDelta, isOpenOrder, buyer } = params;
  const seller = provider.wallet.publicKey;
  const lamports = BigInt(Math.round(solAmount * 1_000_000_000));

  const [tradePda] = findTradePda(tradeId);
  const [vaultPda] = findVaultPda(tradeId);
  const [oracleConfigPda] = findOracleConfigPda();
  const buyerPk = buyer ?? new PublicKey(ZERO_PUBKEY);

  const ix = createTradeIx(
    seller, tradePda, vaultPda, oracleConfigPda, buyerPk,
    tradeId, lamports, inrAmount, payeeVpaHash, BigInt(deadlineDelta), isOpenOrder,
  );

  const tx = new Transaction().add(ix);
  return provider.sendAndConfirm(tx);
}

export async function matchOrder(
  provider: AnchorProvider,
  params: { tradeId: Uint8Array },
): Promise<string> {
  const buyer = provider.wallet.publicKey;
  const [tradePda] = findTradePda(params.tradeId);
  const ix = matchOrderIx(buyer, tradePda, params.tradeId);
  const tx = new Transaction().add(ix);
  return provider.sendAndConfirm(tx);
}

export async function releaseWithAttestation(
  provider: AnchorProvider,
  params: {
    tradeId: Uint8Array;
    trade: SolanaTradeInfo;
    attestation: OracleAttestationData;
    oraclePubkeyHex: string;
  },
): Promise<string> {
  const { tradeId, trade, attestation, oraclePubkeyHex } = params;

  // Build 160-byte attestation message and compute SHA256 (what oracle signed)
  const message = buildAttestationMessage(tradeId, {
    inrAmount: BigInt(attestation.inrAmount),
    payerHash: Buffer.from(attestation.payerHash, 'hex'),
    payeeHash: Buffer.from(attestation.payeeHash, 'hex'),
    timestamp: BigInt(attestation.timestamp),
    expiresAt: BigInt(attestation.expiresAt),
    evidenceHash: Buffer.from(attestation.evidenceHash, 'hex'),
    riskScore: attestation.riskScore,
  });
  const digest = sha256(message);

  // Ed25519 instruction verifies the oracle's signature over SHA256(message)
  const oraclePubkeyBytes = Buffer.from(oraclePubkeyHex, 'hex');
  const sigBytes = Buffer.from(attestation.signature, 'hex');
  const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
    publicKey: oraclePubkeyBytes,
    message: digest,
    signature: sigBytes,
  });

  // Attestation record PDA seeded by trade_id (one per trade)
  const [attRecordPda] = findAttestationRecordPda(tradeId);
  const [tradePda] = findTradePda(tradeId);
  const [vaultPda] = findVaultPda(tradeId);
  const [oracleConfigPda] = findOracleConfigPda();
  const buyerPubkey = new PublicKey(trade.buyer);
  const payer = provider.wallet.publicKey;

  // Ed25519 ix is at index 0; program ix references it
  const programIx = releaseWithAttestationIx(
    payer, tradePda, vaultPda, buyerPubkey, attRecordPda, oracleConfigPda,
    0, attestation,
  );

  const tx = new Transaction().add(ed25519Ix).add(programIx);
  return provider.sendAndConfirm(tx);
}

export async function cancelExpiredTrade(
  provider: AnchorProvider,
  params: { tradeId: Uint8Array; seller: string },
): Promise<string> {
  const caller = provider.wallet.publicKey;
  const [tradePda] = findTradePda(params.tradeId);
  const [vaultPda] = findVaultPda(params.tradeId);
  const sellerPubkey = new PublicKey(params.seller);
  const ix = cancelExpiredIx(caller, tradePda, vaultPda, sellerPubkey, params.tradeId);
  const tx = new Transaction().add(ix);
  return provider.sendAndConfirm(tx);
}

export async function raiseDispute(
  provider: AnchorProvider,
  params: { tradeId: Uint8Array },
): Promise<string> {
  const initiator = provider.wallet.publicKey;
  const [tradePda] = findTradePda(params.tradeId);
  const ix = disputeIx(initiator, tradePda, params.tradeId);
  const tx = new Transaction().add(ix);
  return provider.sendAndConfirm(tx);
}

export async function resolveDispute(
  provider: AnchorProvider,
  params: { tradeId: Uint8Array; seller: string; buyer: string; releaseToBuyer: boolean },
): Promise<string> {
  const admin = provider.wallet.publicKey;
  const [tradePda] = findTradePda(params.tradeId);
  const [vaultPda] = findVaultPda(params.tradeId);
  const [oracleConfigPda] = findOracleConfigPda();
  const sellerPubkey = new PublicKey(params.seller);
  const buyerPubkey  = new PublicKey(params.buyer);

  const disc = instructionDiscriminator('resolve_dispute');
  const buf  = Buffer.alloc(8 + 32 + 1);
  disc.copy(buf);
  Buffer.from(params.tradeId).copy(buf, 8);
  buf.writeUInt8(params.releaseToBuyer ? 1 : 0, 40);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: tradePda,        isSigner: false, isWritable: true  },
      { pubkey: vaultPda,        isSigner: false, isWritable: true  },
      { pubkey: sellerPubkey,    isSigner: false, isWritable: true  },
      { pubkey: buyerPubkey,     isSigner: false, isWritable: true  },
      { pubkey: oracleConfigPda, isSigner: false, isWritable: false },
      { pubkey: admin,           isSigner: true,  isWritable: true  },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: buf,
  });

  const tx = new Transaction().add(ix);
  return provider.sendAndConfirm(tx);
}

export async function getTrade(
  connection: Connection,
  tradeId: Uint8Array,
): Promise<SolanaTradeInfo | null> {
  const [tradePda] = findTradePda(tradeId);
  const info = await connection.getAccountInfo(tradePda);
  if (!info || info.data.length < 8) return null;
  const disc = accountDiscriminator('Trade');
  if (!info.data.slice(0, 8).equals(disc)) return null;
  return deserializeTrade(Buffer.from(info.data));
}

export async function getOracleConfig(
  connection: Connection,
): Promise<SolanaOracleConfig | null> {
  const [cfgPda] = findOracleConfigPda();
  const info = await connection.getAccountInfo(cfgPda);
  if (!info || info.data.length < 8) return null;
  return deserializeOracleConfig(Buffer.from(info.data));
}

export async function getSolBalance(
  connection: Connection,
  pubkey: string,
): Promise<bigint> {
  const lamports = await connection.getBalance(new PublicKey(pubkey));
  return BigInt(lamports);
}
