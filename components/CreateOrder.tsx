'use client';

import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@coral-xyz/anchor';
import type { AnchorWallet } from '@solana/wallet-adapter-react';
import { createHash } from 'crypto';
import { createTrade } from '@/lib/solana/program';
import { generateTradeId, txExplorerUrl } from '@/lib/solana/utils';
import { getRate } from '@/lib/solana/oracle';
import { UpiQrCode } from './UpiQrCode';
import { CheckCircle, ExternalLink } from 'lucide-react';

export function CreateOrder() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [solInr, setSolInr] = useState<number | null>(null);
  const [solAmount, setSolAmount] = useState('1');
  const [inrAmount, setInrAmount] = useState('13500');
  const [sellerVpa, setSellerVpa] = useState('');
  const [timeoutSec, setTimeoutSec] = useState('86400');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ txSig: string; tradeIdHex: string } | null>(null);

  useEffect(() => {
    getRate()
      .then((r) => {
        setSolInr(r.inrPerSol);
        setInrAmount(((parseFloat(solAmount) || 1) * r.inrPerSol).toFixed(0));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSolChange = (val: string) => {
    setSolAmount(val);
    if (solInr) setInrAmount(((parseFloat(val) || 0) * solInr).toFixed(0));
  };

  const handleInrChange = (val: string) => {
    setInrAmount(val);
    if (solInr) setSolAmount(((parseFloat(val) || 0) / solInr).toFixed(4));
  };

  const handleSubmit = async () => {
    setError('');
    if (!sellerVpa.trim()) { setError('Enter your UPI VPA (e.g. you@hdfc)'); return; }
    const solNum = parseFloat(solAmount);
    if (!solNum || solNum <= 0) { setError('Enter a valid SOL amount'); return; }
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Wallet not connected'); return;
    }

    setPending(true);
    try {
      const { hex: tradeIdHex, bytes: tradeIdBytes } = generateTradeId();
      const inrPaisa = BigInt(Math.round((parseFloat(inrAmount) || 0) * 100));
      const payeeVpaHash = new Uint8Array(
        createHash('sha256').update(sellerVpa.trim()).digest()
      );

      const provider = new AnchorProvider(connection, wallet as AnchorWallet, { commitment: 'confirmed' });
      const txSig = await createTrade(provider, {
        tradeId: tradeIdBytes,
        solAmount: solNum,
        inrAmount: inrPaisa,
        payeeVpaHash,
        deadlineDelta: parseInt(timeoutSec) || 86400,
        isOpenOrder: true,
      });

      setDone({ txSig, tradeIdHex });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  };

  if (!wallet.connected) {
    return (
      <div className="app-connect-prompt">
        <p>Connect your Solana wallet to list a sell order.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="create-success">
        <div className="app-success-banner">
          <CheckCircle size={20} />
          <div>
            <p className="app-success-title">Order Listed on Solana</p>
            <p className="app-success-sub">
              {parseFloat(solAmount).toFixed(4)} SOL locked · ₹{parseFloat(inrAmount).toLocaleString('en-IN')} requested
            </p>
            <a href={txExplorerUrl(done.txSig)} target="_blank" rel="noopener noreferrer" className="app-tx-link">
              View on Solana Explorer <ExternalLink size={12} />
            </a>
          </div>
        </div>

        <UpiQrCode
          sellerVpa={sellerVpa}
          inrAmountRupees={(parseFloat(inrAmount) || 0).toFixed(2)}
          tradeId={done.tradeIdHex}
        />

        <p className="create-success-note">
          Share this QR with the buyer. Once they pay and the oracle verifies,
          SOL is auto-released from the escrow vault.
        </p>

        <div className="trade-id-box">{done.tradeIdHex}</div>

        <button onClick={() => setDone(null)} className="app-btn app-btn--ghost app-btn--full">
          List another order
        </button>
      </div>
    );
  }

  return (
    <div className="create-order">
      {solInr && (
        <p className="create-order-rate">
          Market rate: ₹{solInr.toLocaleString('en-IN')} / SOL
        </p>
      )}

      <div className="form-grid">
        <div className="form-field">
          <label className="form-label">SOL amount to sell</label>
          <input
            className="form-input"
            value={solAmount}
            onChange={(e) => handleSolChange(e.target.value)}
            placeholder="1"
            type="number"
            min="0"
            step="0.1"
          />
        </div>
        <div className="form-field">
          <label className="form-label">You want (INR ₹)</label>
          <input
            className="form-input"
            value={inrAmount}
            onChange={(e) => handleInrChange(e.target.value)}
            placeholder="13500"
            type="number"
            min="0"
            step="1"
          />
        </div>
        <div className="form-field">
          <label className="form-label">Your UPI VPA</label>
          <input
            className="form-input"
            value={sellerVpa}
            onChange={(e) => setSellerVpa(e.target.value)}
            placeholder="yourname@hdfc"
          />
          <p className="form-hint">Buyer pays INR directly to this VPA</p>
        </div>
        <div className="form-field">
          <label className="form-label">Order timeout</label>
          <select
            className="form-input"
            value={timeoutSec}
            onChange={(e) => setTimeoutSec(e.target.value)}
          >
            <option value="3600">1 hour</option>
            <option value="21600">6 hours</option>
            <option value="86400">24 hours</option>
            <option value="259200">3 days</option>
          </select>
        </div>
      </div>

      {error && <p className="app-error">{error}</p>}

      <div className="create-order-info">
        <p>Your SOL is locked in the on-chain escrow vault until a buyer pays and the oracle verifies.</p>
        <p>The 1% TDS (Section 194S) will appear in your compliance record after the trade completes.</p>
      </div>

      <button
        onClick={handleSubmit}
        disabled={pending}
        className="app-btn app-btn--primary app-btn--full"
      >
        {pending
          ? 'Signing & submitting…'
          : `Sell ${parseFloat(solAmount).toFixed(4)} SOL for ₹${parseFloat(inrAmount).toLocaleString('en-IN')}`}
      </button>
    </div>
  );
}
