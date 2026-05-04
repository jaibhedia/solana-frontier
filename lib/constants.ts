import type { AccentKey, Route, StatusOption, Tweaks } from '@/types';
import { PublicKey } from '@solana/web3.js';

// ─── Landing page ──────────────────────────────────────────────────────────────

export const TWEAK_DEFAULTS: Tweaks = {
  accent: 'terracotta',
  heroLayout: 'A',
  dark: false,
};

export const ACCENT_MAP: Record<AccentKey, Record<string, string>> = {
  terracotta: { '--accent': '#B8472C', '--accent-2': '#6B7A3E', '--accent-3': '#C98A58' },
  olive:      { '--accent': '#6B7A3E', '--accent-2': '#B8472C', '--accent-3': '#C98A58' },
  clay:       { '--accent': '#C98A58', '--accent-2': '#6B7A3E', '--accent-3': '#B8472C' },
  rose:       { '--accent': '#C98585', '--accent-2': '#6B7A3E', '--accent-3': '#C98A58' },
  ink:        { '--accent': '#1A1410', '--accent-2': '#6B7A3E', '--accent-3': '#C98A58' },
};

export const ROUTES: Route[] = [
  { from: 'USDC',  to: 'INR', fromRate: 83.2,  region: 'IN' },
  { from: 'USDC',  to: 'BRL', fromRate: 5.07,  region: 'BR' },
  { from: 'USDT',  to: 'NGN', fromRate: 1640,  region: 'NG' },
  { from: 'EURC',  to: 'EUR', fromRate: 1.0,   region: 'EU' },
  { from: 'USDC',  to: 'MXN', fromRate: 17.3,  region: 'MX' },
  { from: 'USDT',  to: 'IDR', fromRate: 16200, region: 'ID' },
  { from: 'PYUSD', to: 'PHP', fromRate: 56.1,  region: 'PH' },
  { from: 'USDC',  to: 'KES', fromRate: 128.4, region: 'KE' },
];

export const STATUSES: StatusOption[] = [
  { label: 'settled',   cls: 'ok' },
  { label: 'attesting', cls: 'attest' },
  { label: 'pending',   cls: 'pending' },
];

// ─── Env vars ──────────────────────────────────────────────────────────────────

export const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const SOLANA_RPC        = process.env.NEXT_PUBLIC_SOLANA_RPC_URL    ?? 'https://api.devnet.solana.com';
export const APP_VERSION       = process.env.NEXT_PUBLIC_APP_VERSION       ?? 'v0.9.2';
export const BETA_LABEL        = process.env.NEXT_PUBLIC_BETA_LABEL        ?? 'India · UPI settlement · Solana devnet';

export const PROGRAM_ID_STR    = process.env.NEXT_PUBLIC_PROGRAM_ID        ?? 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS';
export const ORACLE_PUBKEY_HEX = process.env.NEXT_PUBLIC_ORACLE_PUBKEY_HEX ?? '';

export const PROGRAM_ID = new PublicKey(PROGRAM_ID_STR);

// ─── Solana ────────────────────────────────────────────────────────────────────

export const LAMPORTS_PER_SOL = 1_000_000_000n;

export const TRADE_STATUS = ['None', 'Active', 'Released', 'Disputed', 'Cancelled', 'Resolved'] as const;

export const ZERO_PUBKEY = '11111111111111111111111111111111';

export const EXPLORER_BASE = 'https://explorer.solana.com';
export const SOLANA_CLUSTER = 'devnet';
