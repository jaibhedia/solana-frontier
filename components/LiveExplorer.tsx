'use client';

import { useState, useEffect } from 'react';
import StatCard from './StatCard';
import { accountExplorerUrl, formatAddress } from '@/lib/solana/utils';
import { TRADE_STATUS } from '@/lib/constants';

interface OnChainTrade {
  pubkey: string;
  tradeId: string;
  seller: string;
  buyer: string;
  lamports: string;
  inrAmount: string;
  deadline: number;
  status: number;
  statusLabel: string;
  createdAt: number;
  releasedAt: number;
}

interface Stats {
  totalTrades: number;
  totalVolSol: string;
}

const STATUS_CLS: Record<string, string> = {
  Active:    'attest',
  Released:  'ok',
  Disputed:  'pending',
  Cancelled: 'pending',
  Resolved:  'ok',
};

export default function LiveExplorer() {
  const [trades, setTrades]     = useState<OnChainTrade[]>([]);
  const [stats, setStats]       = useState<Stats>({ totalTrades: 0, totalVolSol: '0' });
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<number | 'all'>('all');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [tradesRes, statsRes] = await Promise.all([
          fetch('/api/trades'),
          fetch('/api/stats'),
        ]);
        const tradesData = await tradesRes.json();
        const statsData  = await statsRes.json();
        if (!cancelled) {
          setTrades(tradesData.trades ?? []);
          setStats({ totalTrades: statsData.totalTrades ?? 0, totalVolSol: statsData.totalVolSol ?? '0' });
        }
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const filtered = filter === 'all'
    ? trades
    : trades.filter(t => t.status === filter);

  const solUsd = parseFloat(stats.totalVolSol) * 142;

  return (
    <section className="section" id="explorer">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="section-num">§ 02 — Explorer</div>
            <h2 className="section-title">Every attestation,<br /><em>public by default.</em></h2>
          </div>
          <p className="section-kicker">
            Live on-chain trades from the uWu escrow program on Solana Devnet.
            Click any row to inspect on the block explorer.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['all', 1, 2, 3, 4] as const).map(f => {
            const label = f === 'all' ? 'all trades' : TRADE_STATUS[f as number] ?? String(f);
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="btn tiny ghost"
                style={{
                  background: filter === f ? 'var(--ink)' : 'transparent',
                  color: filter === f ? 'var(--paper)' : 'var(--ink)',
                }}
              >{label}</button>
            );
          })}
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            devnet · live
          </span>
        </div>

        <div className="feed-wrap">
          <div className="feed">
            <div className="feed-head">
              <span>trade id · seller · amount · status</span>
              <span className="live"><i></i>{filtered.length} trade{filtered.length !== 1 ? 's' : ''}</span>
            </div>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-mute)' }}>
                Fetching on-chain data…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-mute)' }}>
                No trades on-chain yet —{' '}
                <a href="/trade" style={{ color: 'var(--accent)' }}>be the first to trade</a>
              </div>
            ) : (
              <ul>
                {filtered.map((t) => (
                  <li key={t.pubkey}>
                    <span className="id">
                      <a
                        href={accountExplorerUrl(t.pubkey)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'inherit', textDecoration: 'none' }}
                      >0x{t.tradeId.slice(0, 6)}</a>
                    </span>
                    <span className="route">
                      <span className="chip sol">SOL</span>
                      <span style={{ color: 'var(--ink-mute)' }}>→</span>
                      <span className="chip inr">INR</span>
                    </span>
                    <span className="amt">
                      {(Number(t.lamports) / 1e9).toFixed(3)} SOL
                      {BigInt(t.inrAmount) > 0n && (
                        <span style={{ color: 'var(--ink-mute)', marginLeft: 4 }}>
                          · ₹{(Number(t.inrAmount) / 100).toLocaleString('en-IN')}
                        </span>
                      )}
                    </span>
                    <span className={`status ${STATUS_CLS[t.statusLabel] ?? ''}`}>
                      {t.statusLabel}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="stats">
            <StatCard
              label="total volume (SOL)"
              value={stats.totalVolSol + ' SOL'}
              delta={`≈ $${solUsd.toFixed(0)} at current rate`}
            />
            <StatCard
              label="settlements on-chain"
              value={stats.totalTrades.toLocaleString()}
              delta="since program deploy"
              variant="bars"
            />
            <StatCard
              label="network"
              value="Devnet"
              delta="Solana · Agave 3.1"
              variant="flat"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
