import { ROUTES, STATUSES } from './constants';
import type { TxRow } from '@/types';

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randId(): string {
  const hex = '0123456789abcdef';
  let s = '0x';
  for (let i = 0; i < 6; i++) s += hex[Math.floor(Math.random() * 16)];
  return s;
}

export function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(0);
}

export function genRow(): TxRow {
  const r = ROUTES[randInt(0, ROUTES.length - 1)];
  const amt = randInt(50, 50000);
  const st = STATUSES[randInt(0, STATUSES.length - 1)];
  return {
    id: randId(),
    from: r.from,
    to: r.to,
    amt,
    fiat: Math.round(amt * r.fromRate),
    status: st.label,
    cls: st.cls,
    t: Date.now(),
  };
}
