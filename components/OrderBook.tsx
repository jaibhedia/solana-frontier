'use client';

import { useState, useEffect } from 'react';
import { lamportsToSol, paisaToInr } from '@/lib/solana/utils';
import { ZERO_PUBKEY } from '@/lib/constants';
import type { OpenOrder } from '@/types';

interface OrderBookProps {
  onMatch: (order: OpenOrder) => void;
}

export function OrderBook({ onMatch }: OrderBookProps) {
  const [orders, setOrders]   = useState<OpenOrder[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadOrders() {
    try {
      const res  = await fetch('/api/trades');
      const data = await res.json();
      const now  = Math.floor(Date.now() / 1000);
      const open: OpenOrder[] = (data.trades ?? [])
        .filter((t: { status: number; buyer: string; deadline: number }) =>
          t.status === 1 && t.buyer === ZERO_PUBKEY && t.deadline > now
        )
        .map((t: {
          tradeId: string; seller: string; lamports: string;
          inrAmount: string; deadline: number;
        }) => ({
          tradeIdHex: t.tradeId,
          seller:     t.seller,
          lamports:   BigInt(t.lamports),
          inrAmount:  BigInt(t.inrAmount),
          deadline:   BigInt(t.deadline),
        }));
      setOrders(open);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    loadOrders();
    const t = setInterval(loadOrders, 15_000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return <div className="app-loading">Reading open orders from Solana…</div>;
  }

  return (
    <div className="order-book">
      <div className="order-book-header">
        <p className="order-book-note">
          {orders.length === 0
            ? 'No open orders on-chain yet.'
            : `${orders.length} open order${orders.length !== 1 ? 's' : ''} — match one to become the buyer and pay via UPI`}
        </p>
        <button
          onClick={loadOrders}
          className="app-btn app-btn--ghost"
          style={{ marginTop: '0.5rem', padding: '4px 10px', fontSize: '0.78rem' }}
        >↻ Refresh</button>
      </div>

      {orders.length === 0 ? (
        <div className="app-empty" style={{ padding: '2rem 0' }}>
          No open orders on Solana Devnet yet.{' '}
          <span style={{ color: 'var(--accent)' }}>Switch to &ldquo;Sell SOL&rdquo; to create one.</span>
        </div>
      ) : (
        <div className="order-book-list">
          {orders.map(order => {
            const solStr    = lamportsToSol(order.lamports);
            const inrStr    = paisaToInr(order.inrAmount);
            const expiresIn = Number(order.deadline) - Math.floor(Date.now() / 1000);
            const hoursLeft = Math.max(0, Math.floor(expiresIn / 3600));
            const rate      = order.lamports > 0n
              ? ((Number(order.inrAmount) / 100) / (Number(order.lamports) / 1e9)).toFixed(0)
              : '—';

            return (
              <div key={order.tradeIdHex} className="order-card">
                <div className="order-card-row">
                  <div>
                    <p className="order-card-sol">{solStr} SOL</p>
                    <p className="order-card-inr">₹{inrStr}</p>
                  </div>
                  <div className="order-card-meta">
                    <p className="order-card-rate">₹{rate} / SOL</p>
                    <p className="order-card-expiry">{hoursLeft}h left</p>
                  </div>
                  <button
                    onClick={() => onMatch(order)}
                    className="app-btn app-btn--primary"
                  >Buy</button>
                </div>
                <p className="order-card-id">0x{order.tradeIdHex.slice(0, 20)}…</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
