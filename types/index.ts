// ─── Landing-page types ───────────────────────────────────────────────────────

export type AccentKey = 'terracotta' | 'olive' | 'clay' | 'rose' | 'ink';
export type HeroLayout = 'A' | 'B' | 'C';

export interface Tweaks {
  accent: AccentKey;
  heroLayout: HeroLayout;
}

export type StatusCls = 'ok' | 'attest' | 'pending';

export interface TxRow {
  id: string;
  from: string;
  to: string;
  amt: number;
  fiat: number;
  status: string;
  cls: StatusCls;
  t: number;
  isNew?: boolean;
}

export interface Route {
  from: string;
  to: string;
  fromRate: number;
  region: string;
}

export interface StatusOption {
  label: string;
  cls: StatusCls;
}

export type SparkVariant = 'line' | 'bars' | 'flat';

export interface StatCardProps {
  label: string;
  value: string;
  delta: string;
  variant?: SparkVariant;
}

export interface TweaksPanelProps {
  tweaks: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
}

export interface HowStep {
  n: string;
  title: string;
  body: string;
  art: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

// ─── Solana / App types ────────────────────────────────────────────────────────

export type TradeStatusLabel = 'None' | 'Active' | 'Released' | 'Disputed' | 'Cancelled' | 'Resolved';

export interface SolanaTradeInfo {
  tradeId: string;          // 64-char hex
  seller: string;           // base58 pubkey
  buyer: string;            // base58 pubkey or ZERO_ADDRESS for open orders
  lamports: bigint;
  inrAmount: bigint;        // paisa
  payeeVpaHash: string;     // 64-char hex
  deadline: bigint;         // unix timestamp
  status: number;           // 0–5
  createdAt: bigint;
  releasedAt: bigint;
}

export interface SolanaOracleConfig {
  admin: string;
  oraclePubkey: string;
  totalTrades: bigint;
  totalVolLamports: bigint;
}

export interface AttestationPayloadInput {
  inrAmount: bigint;
  payerHash: Uint8Array;    // 32 bytes
  payeeHash: Uint8Array;    // 32 bytes
  timestamp: bigint;
  expiresAt: bigint;
  evidenceHash: Uint8Array; // 32 bytes
  riskScore: number;
}

export interface OracleAttestationData {
  tradeId: string;
  inrAmount: number;        // paisa
  payerHash: string;        // 64-char hex
  payeeHash: string;        // 64-char hex
  timestamp: number;
  expiresAt: number;
  evidenceHash: string;     // 64-char hex
  riskScore: number;
  signature: string;        // 128-char hex (64-byte ed25519)
}

export interface OracleAttestationResponse {
  success: boolean;
  attestation: OracleAttestationData;
  attestationHash: string;
  signature: string;
  riskScore: number;
  oraclePubkey: string;     // 64-char hex
  tds?: TdsInfo;
}

export interface TdsInfo {
  inrAmountPaisa: number;
  inrAmountRupees: string;
  tdsAmountPaisa: number;
  tdsAmountRupees: string;
  tdsRate: number;
  applicable: boolean;
  section: string;
  fy: string;
}

export interface OracleRate {
  inrPerSol: number;
  inrPerUsd: number;
}

export interface TaxLine {
  label: string;
  section: string;
  rate: number;
  amountMinor: number;
  amountFormatted: string;
  applicable: boolean;
  notes?: string;
}

export interface TxnRecord {
  tradeId: string;
  seller: string;
  buyer: string;
  solLamports: number;
  fiatAmountMinor: number;
  fiatCurrency: string;
  country: string;
  utrNumber?: string;
  payerVpa?: string;
  attestationHash?: string;
  riskScore?: number;
  taxes: TaxLine[];
  txSignature: string;
  releasedAt: number;
  createdAt: number;
}

export interface OpenOrder {
  tradeIdHex: string;
  seller: string;
  lamports: bigint;
  inrAmount: bigint;
  deadline: bigint;
}
