'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { lamportsToSol, paisaToInr, accountExplorerUrl, formatAddress } from '@/lib/solana/utils';
import { PROGRAM_ID_STR, TRADE_STATUS, ZERO_PUBKEY } from '@/lib/constants';

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
  const [balance, setBalance] = useState<string | null>(null);
  const [myTrades, setMyTrades] = useState<TradeRow[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

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
        </div>
      </section>

      {/* My Trades */}
      {connected && (
        <section>
          <p className="section-label">My Trades</p>
          {tradesLoading ? (
            <div className="app-loading" style={{ padding: '1rem 0' }}>Loading your trades…</div>
          ) : myTrades.length === 0 ? (
            <div className="app-empty" style={{ padding: '1.5rem', border: '1px solid var(--rule)', borderRadius: 10 }}>
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
