/**
 * One-time script: initialize the oracle config PDA on devnet.
 * Run: node scripts/init-oracle.mjs
 */
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { createHash } from 'crypto';
import bs58 from 'bs58';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
const RPC        = 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('G8LyjnQ6xYW2txzk2nbiUpcdGC82AvmcXuMSEhSjutXU');
const ORACLE_PUBKEY_HEX = '7f3a67da1beaa46757ea915109f548470f45bcff35ecf68b212c9e14a9f07a62';

// Load the deployer/admin wallet
const walletPath = path.join(process.env.HOME, '.config/solana/id.json');
const adminKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
);

// ── Helpers ───────────────────────────────────────────────────────────────────
function discriminator(name) {
  return createHash('sha256').update(`global:${name}`).digest().slice(0, 8);
}

function findPda(seeds) {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const connection = new Connection(RPC, 'confirmed');
const [oracleConfigPda, bump] = findPda([Buffer.from('oracle-config')]);

// Check if already initialized
const existing = await connection.getAccountInfo(oracleConfigPda);
if (existing) {
  console.log('Oracle config already initialized at:', oracleConfigPda.toBase58());
  process.exit(0);
}

console.log('Admin:', adminKeypair.publicKey.toBase58());
console.log('Oracle config PDA:', oracleConfigPda.toBase58());
console.log('Oracle pubkey:', ORACLE_PUBKEY_HEX);

// Build initialize instruction
// Borsh layout: discriminator(8) + oracle_pubkey(32)
const disc = discriminator('initialize');
const oraclePubkeyBytes = Buffer.from(ORACLE_PUBKEY_HEX, 'hex');
const data = Buffer.concat([disc, oraclePubkeyBytes]);

const ix = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: oracleConfigPda,          isSigner: false, isWritable: true  },
    { pubkey: adminKeypair.publicKey,   isSigner: true,  isWritable: true  },
    { pubkey: SystemProgram.programId,  isSigner: false, isWritable: false },
  ],
  data,
});

const tx = new Transaction().add(ix);
tx.feePayer = adminKeypair.publicKey;
tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
tx.sign(adminKeypair);

const sig = await connection.sendRawTransaction(tx.serialize());
await connection.confirmTransaction(sig, 'confirmed');

console.log('✅ Oracle config initialized!');
console.log('Signature:', sig);
console.log(`Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
