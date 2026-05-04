'use client';

import { useState } from 'react';
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
  const [error, setError] = useState('');

  const solStr = lamportsToSol(order.lamports);
  const inrStr = paisaToInr(order.inrAmount);

  const handleMatch = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setError('');
    setPending(true);
    try {
      const provider = new AnchorProvider(connection, wallet as AnchorWallet, { commitment: 'confirmed' });
      const tradeIdBytes = Buffer.from(order.tradeIdHex, 'hex');
      const sig = await matchOrder(provider, { tradeId: tradeIdBytes });
      setDone(sig);
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
          You are now the buyer for {solStr} SOL. Pay ₹{inrStr} via UPI to the seller,
          then come back to verify and release.
        </p>
        <a href={txExplorerUrl(done)} target="_blank" rel="noopener noreferrer" className="app-btn app-btn--ghost">
          View tx <ExternalLink size={14} />
        </a>
        <button onClick={onBack} className="app-btn app-btn--primary" style={{ marginTop: '1rem' }}>
          Back to market
        </button>
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
          <span>You pay (via UPI)</span>
          <strong className="accent">₹{inrStr}</strong>
        </div>
        <div className="trade-summary-row">
          <span>Seller</span>
          <span className="mono-sm">{order.seller}</span>
        </div>
      </div>

      <p className="match-form-note">
        Matching locks your intent on-chain. After matching, pay the INR via UPI,
        then use the trade detail page to verify and release SOL to your wallet.
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
