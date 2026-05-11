'use client';

import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@coral-xyz/anchor';
import type { AnchorWallet } from '@solana/wallet-adapter-react';
import { resolveDispute } from '@/lib/solana/program';
import { lamportsToSol, paisaToInr, txExplorerUrl } from '@/lib/solana/utils';
import { ADMIN_PUBKEY } from '@/lib/constants';
import { CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';

type DisputedTrade = {
  tradeId: string;
  seller: string;
  buyer: string;
  lamports: string;
  inrAmount: string;
  createdAt: number;
};

export default function AdminPage() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [trades, setTrades] = useState<DisputedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const isAdmin = wallet.publicKey?.toBase58() === ADMIN_PUBKEY;

  useEffect(() => {
    fetch('/api/trades')
      .then(r => r.json())
      .then(d => {
        const disputed = (d.trades ?? []).filter((t: { status: number }) => t.status === 3);
        setTrades(disputed);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const resolve = async (trade: DisputedTrade, releaseToBuyer: boolean) => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setResolving(trade.tradeId);
    setError('');
    try {
      const provider = new AnchorProvider(connection, wallet as AnchorWallet, { commitment: 'confirmed' });
      const tradeIdBytes = Buffer.from(trade.tradeId, 'hex');
      const sig = await resolveDispute(provider, {
        tradeId: tradeIdBytes,
        seller: trade.seller,
        buyer: trade.buyer,
        releaseToBuyer,
      });
      setResults(r => ({ ...r, [trade.tradeId]: sig }));
      setTrades(t => t.filter(x => x.tradeId !== trade.tradeId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setResolving(null);
    }
  };

  if (!wallet.connected) {
    return (
      <div className="app-card app-connect-prompt">
        <p>Connect the admin wallet to access this page.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="app-card app-empty">
        <p className="text-danger">Unauthorized — admin access only</p>
        <Link href="/dashboard" className="app-link mt-3" style={{ display: 'inline-block' }}>← Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div>
        <Link href="/dashboard" className="app-back-link">← Dashboard</Link>
        <h1 className="page-title mt-2">Admin · Dispute Resolution</h1>
        <p className="page-sub">Resolve disputed trades by releasing SOL to the buyer or refunding the seller.</p>
      </div>

      {error && <p className="app-error">{error}</p>}

      {Object.entries(results).map(([id, sig]) => (
        <div key={id} className="app-success-banner">
          <CheckCircle size={16} />
          <div>
            <p className="app-success-title">Resolved {id.slice(0, 12)}…</p>
            <a href={txExplorerUrl(sig)} target="_blank" rel="noopener noreferrer" className="app-tx-link">
              View tx <ExternalLink size={12} />
            </a>
          </div>
        </div>
      ))}

      {loading ? (
        <div className="app-card app-loading">Loading disputed trades…</div>
      ) : trades.length === 0 ? (
        <div className="app-card app-empty"><p>No disputed trades.</p></div>
      ) : (
        trades.map(trade => (
          <div key={trade.tradeId} className="app-card">
            <p className="mono-sm mb-3">
              {trade.tradeId.slice(0, 24)}…
            </p>
            <dl className="trade-detail-dl mb-4">
              <div className="trade-detail-row"><dt>SOL</dt><dd>{lamportsToSol(BigInt(trade.lamports))} SOL</dd></div>
              <div className="trade-detail-row"><dt>INR</dt><dd className="accent">₹{paisaToInr(BigInt(trade.inrAmount))}</dd></div>
              <div className="trade-detail-row"><dt>Seller</dt><dd className="mono-sm">{trade.seller.slice(0, 20)}…</dd></div>
              <div className="trade-detail-row"><dt>Buyer</dt><dd className="mono-sm">{trade.buyer.slice(0, 20)}…</dd></div>
              <div className="trade-detail-row"><dt>Created</dt><dd>{new Date(trade.createdAt * 1000).toLocaleString()}</dd></div>
            </dl>
            <div className="seller-share-row">
              <button
                onClick={() => resolve(trade, true)}
                disabled={resolving === trade.tradeId}
                className="app-btn app-btn--primary"
              >
                {resolving === trade.tradeId ? <Loader2 size={14} className="spin" /> : null}
                Release to buyer
              </button>
              <button
                onClick={() => resolve(trade, false)}
                disabled={resolving === trade.tradeId}
                className="app-btn app-btn--warning"
              >
                {resolving === trade.tradeId ? <Loader2 size={14} className="spin" /> : null}
                Refund to seller
              </button>
              <Link href={`/trade/${trade.tradeId}`} className="app-btn app-btn--ghost">
                View trade
              </Link>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
