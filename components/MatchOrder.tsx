'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@coral-xyz/anchor';
import type { AnchorWallet } from '@solana/wallet-adapter-react';
import { matchOrder } from '@/lib/solana/program';
import { lamportsToSol, paisaToInr, txExplorerUrl } from '@/lib/solana/utils';
import { ExternalLink, CheckCircle } from 'lucide-react';
import type { OpenOrder } from '@/types';

interface MatchOrderProps {
  order: OpenOrder;
  onBack: () => void;
}

export function MatchOrder({ order, onBack }: MatchOrderProps) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [fetchedVpa, setFetchedVpa] = useState('');
  const [error, setError] = useState('');

  const verificationMode = useMemo(
    () => (process.env.NEXT_PUBLIC_VERIFICATION_MODE ?? 'mock').toLowerCase(),
    [],
  );

  const solStr = lamportsToSol(order.lamports);
  const inrStr = paisaToInr(order.inrAmount);
  const tradeHref = useMemo(() => {
    const vpaQ = fetchedVpa ? `vpa=${encodeURIComponent(fetchedVpa)}` : '';
    if (verificationMode === 'setu') {
      return `/trade/${order.tradeIdHex}?focus=setu${vpaQ ? `&${vpaQ}` : ''}`;
    }
    return `/trade/${order.tradeIdHex}${vpaQ ? `?${vpaQ}` : ''}`;
  }, [verificationMode, order.tradeIdHex, fetchedVpa]);

  const handleMatch = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setError('');
    setPending(true);
    try {
      const provider = new AnchorProvider(connection, wallet as AnchorWallet, { commitment: 'confirmed' });
      const tradeIdBytes = Buffer.from(order.tradeIdHex, 'hex');
      const sig = await matchOrder(provider, { tradeId: tradeIdBytes });
      setDone(sig);
      // Fetch VPA from Redis to embed in the trade link so buyer sees QR immediately
      fetch(`/api/trades/${order.tradeIdHex}/vpa`)
        .then(async (r) => { if (r.ok) { const d = await r.json() as { vpa?: string }; if (d.vpa) setFetchedVpa(d.vpa); } })
        .catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <div className="match-success">
        <CheckCircle size={40} className="match-success-icon" />
        <h3 className="match-success-title">Order Matched!</h3>
        <p className="match-success-body">
          You are the buyer for {solStr} SOL at ₹{inrStr}. Open your trade page: enter the seller&apos;s UPI VPA,
          scan the QR to pay, then{' '}
          {verificationMode === 'setu'
            ? 'complete Setu Account Aggregator verification and release SOL to this wallet.'
            : 'verify and release SOL to this wallet (mock mode).'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem', width: '100%', maxWidth: 360 }}>
          <Link href={tradeHref} className="app-btn app-btn--primary app-btn--full">
            Continue to pay &amp; verify
          </Link>
          <a href={txExplorerUrl(done)} target="_blank" rel="noopener noreferrer" className="app-btn app-btn--ghost">
            View match tx <ExternalLink size={14} />
          </a>
          <button type="button" onClick={onBack} className="app-btn app-btn--ghost app-btn--full">
            Back to market
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="match-form">
      <button onClick={onBack} className="app-back-link">← Back to market</button>
      <h3 className="match-form-title">Match Order</h3>

      <div className="trade-summary-card">
        <div className="trade-summary-row">
          <span>You receive</span>
          <strong>{solStr} SOL</strong>
        </div>
        <div className="trade-summary-row">
          <span>You pay (INR)</span>
          <strong className="accent">₹{inrStr}</strong>
        </div>
        <div className="trade-summary-row">
          <span>Seller</span>
          <span className="mono-sm">{order.seller}</span>
        </div>
      </div>

      <p className="match-form-note">
        Matching records you as the buyer on-chain. After this, all INR payment, UPI QR, and Setu steps happen on the
        trade page (use a Solana wallet — Phantom or Solflare).
      </p>

      {error && <p className="app-error">{error}</p>}

      {!wallet.connected ? (
        <p className="app-warning">Connect your wallet to match this order.</p>
      ) : (
        <button
          onClick={handleMatch}
          disabled={pending}
          className="app-btn app-btn--primary app-btn--full"
        >
          {pending ? 'Submitting to Solana…' : `Match: Buy ${solStr} SOL for ₹${inrStr}`}
        </button>
      )}
    </div>
  );
}
