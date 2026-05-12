'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { lamportsToSol, paisaToInr, accountExplorerUrl, formatAddress } from '@/lib/solana/utils';
import { PROGRAM_ID_STR, TRADE_STATUS, ZERO_PUBKEY } from '@/lib/constants';
import { COUNTRY_CONFIG, formatFiat } from '@/lib/tax';
import { useUserPrefs } from '@/contexts/UserPrefsContext';
import type { TxnRecord } from '@/types';

type TradeRow = {
  tradeIdHex: string;
  pubkey: string;
  seller: string;
  buyer: string;
  solStr: string;
  inrStr: string;
  status: number;
  createdAt: number;
  role: 'seller' | 'buyer';
};

type Stats = {
  totalTrades: number;
  totalVolSol: string;
};

export default function DashboardPage() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const { prefs } = useUserPrefs();
  const [balance, setBalance] = useState<string | null>(null);
  const [myTrades, setMyTrades] = useState<TradeRow[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [txnRecords, setTxnRecords] = useState<TxnRecord[]>([]);

  useEffect(() => {
    if (!publicKey) { setBalance(null); return; }
    connection.getBalance(publicKey)
      .then((lamports: number) => setBalance(lamportsToSol(BigInt(lamports))))
      .catch(() => setBalance(null));
  }, [publicKey, connection]);

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    if (!publicKey) { setTxnRecords([]); return; }
    fetch(`/api/txns?wallet=${publicKey.toBase58()}&limit=50`)
      .then(r => r.json())
      .then(d => setTxnRecords(d.records ?? []))
      .catch(() => {});
  }, [publicKey]);

  useEffect(() => {
    if (!publicKey) { setMyTrades([]); return; }
    setTradesLoading(true);
    const addr = publicKey.toBase58();
    fetch('/api/trades')
      .then(r => r.json())
      .then((data: { trades: Array<{
        tradeId: string; pubkey: string; seller: string; buyer: string;
        lamports: string; inrAmount: string; status: number; createdAt: number;
      }> }) => {
        const rows: TradeRow[] = (data.trades ?? [])
          .filter(t => t.seller === addr || (t.buyer !== ZERO_PUBKEY && t.buyer === addr))
          .slice(0, 10)
          .map(t => ({
            tradeIdHex: t.tradeId,
            pubkey: t.pubkey,
            seller: t.seller,
            buyer: t.buyer,
            solStr: lamportsToSol(BigInt(t.lamports)),
            inrStr: paisaToInr(BigInt(t.inrAmount)),
            status: t.status,
            createdAt: t.createdAt,
            role: t.seller === addr ? 'seller' : 'buyer',
          }));
        setMyTrades(rows);
      })
      .catch(() => {})
      .finally(() => setTradesLoading(false));
  }, [publicKey]);

  return (
    <div className="page-stack">
      {/* Wallet */}
      <section>
        <p className="section-label">Wallet</p>
        <div className="balance-card">
          <div className="balance-card-amount">
            {connected && balance != null ? `${balance} SOL` : '—'}
          </div>
          <p className="balance-card-sub">
            {connected && publicKey
              ? `${formatAddress(publicKey.toBase58())} · Solana Devnet`
              : 'Not connected'}
          </p>
        </div>
        {!connected && (
          <p className="dashboard-connect-note">Connect your Solana wallet above to get started.</p>
        )}
      </section>

      {/* Actions */}
      <section>
        <p className="section-label">Actions</p>
        <div className="action-grid">
          <Link href="/trade" className="action-card">
            <span className="action-card-icon">↔</span>
            <span className="action-card-title">P2P Market</span>
            <span className="action-card-sub">Sell SOL, lock in escrow, release after UPI payment</span>
          </Link>
          <Link href="/explorer" className="action-card">
            <span className="action-card-icon">⊞</span>
            <span className="action-card-title">Explorer</span>
            <span className="action-card-sub">Browse all trades and their on-chain state</span>
          </Link>
          <Link href="/tax" className="action-card">
            <span className="action-card-icon">◈</span>
            <span className="action-card-title">Tax & History</span>
            <span className="action-card-sub">Settled trades, per-trade taxes, multi-country calculator</span>
          </Link>
        </div>
      </section>

      {/* YTD Tax Summary */}
      {connected && (() => {
        const thisYear = new Date().getFullYear();
        const ytd = txnRecords.filter(r => new Date(r.releasedAt).getFullYear() === thisYear);
        const byCountry: Record<string, { volume: number; tax: number; count: number }> = {};
        for (const r of ytd) {
          const c = byCountry[r.country] ?? { volume: 0, tax: 0, count: 0 };
          c.volume += r.fiatAmountMinor;
          c.tax += r.taxes.filter(t => t.applicable).reduce((s, t) => s + t.amountMinor, 0);
          c.count += 1;
          byCountry[r.country] = c;
        }

        const preferredCountry = prefs.country;

        return (
          <section>
            <p className="section-label">
              {thisYear} Tax Summary · <Link href="/tax" className="app-link">Full breakdown →</Link>
            </p>
            <div className="app-card" style={{ display: 'grid', gap: '0.5rem' }}>
              {/* Nudge if country not set */}
              {!preferredCountry && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Jurisdiction not set</span>
                  <Link href="/tax" className="app-link" style={{ fontSize: 12 }}>
                    Set your country →
                  </Link>
                </div>
              )}

              {Object.keys(byCountry).length === 0 && (
                <p className="form-hint" style={{ margin: 0 }}>No settled trades this year yet.</p>
              )}

              {Object.entries(byCountry).map(([code, data]) => {
                const cfg = COUNTRY_CONFIG[code];
                const isPreferred = code === preferredCountry;
                return (
                  <div key={code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: isPreferred ? 'var(--ink)' : 'var(--ink-2)', fontWeight: isPreferred ? 600 : 400 }}>
                      {cfg?.name ?? code} · {data.count} trade{data.count !== 1 ? 's' : ''}
                      {isPreferred && (
                        <span style={{ marginLeft: 6, fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                          your jurisdiction
                        </span>
                      )}
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)' }}>
                        {formatFiat(data.volume, code)}
                      </span>
                      {data.tax > 0 && (
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', marginLeft: 8 }}>
                          tax {formatFiat(data.tax, code)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* My Trades */}
      {connected && (
        <section>
          <p className="section-label">My Trades</p>
          {tradesLoading ? (
            <div className="app-loading">Loading your trades…</div>
          ) : myTrades.length === 0 ? (
            <div className="app-empty app-card">
              No trades yet.{' '}
              <Link href="/trade" className="app-link">Create your first order →</Link>
            </div>
          ) : (
            <div className="my-trades-list">
              {myTrades.map(t => (
                <Link
                  key={t.tradeIdHex}
                  href={`/trade/${t.tradeIdHex}`}
                  className="my-trade-row"
                >
                  <div className="my-trade-row-left">
                    <span className={`my-trade-role ${t.role === 'seller' ? 'my-trade-role--seller' : 'my-trade-role--buyer'}`}>
                      {t.role}
                    </span>
                    <span className="my-trade-amounts">{t.solStr} SOL · ₹{t.inrStr}</span>
                  </div>
                  <div className="my-trade-row-right">
                    <span className={`status-badge status-badge--${TRADE_STATUS[t.status]?.toLowerCase() ?? 'unknown'}`}>
                      {TRADE_STATUS[t.status] ?? 'Unknown'}
                    </span>
                    <span className="my-trade-id">0x{t.tradeIdHex.slice(0, 8)}… →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Protocol */}
      <section>
        <p className="section-label">Protocol</p>
        <div className="protocol-info">
          <div className="protocol-info-row">
            <span>Program ID</span>
            <a
              href={accountExplorerUrl(PROGRAM_ID_STR)}
              target="_blank"
              rel="noopener noreferrer"
              className="app-link"
            >
              {formatAddress(PROGRAM_ID_STR, 10)} ↗
            </a>
          </div>
          <div className="protocol-info-row">
            <span>Network</span>
            <span>Solana Devnet</span>
          </div>
          <div className="protocol-info-row">
            <span>Oracle</span>
            <span>Ed25519 · in-process</span>
          </div>
          {stats && (
            <>
              <div className="protocol-info-row">
                <span>Total trades</span>
                <span>{stats.totalTrades.toLocaleString()}</span>
              </div>
              <div className="protocol-info-row">
                <span>Total volume</span>
                <span>{stats.totalVolSol} SOL</span>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
