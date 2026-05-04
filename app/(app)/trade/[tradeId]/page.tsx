'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@coral-xyz/anchor';
import type { AnchorWallet } from '@solana/wallet-adapter-react';
import { createHash } from 'crypto';
import { getTrade, releaseWithAttestation, cancelExpiredTrade, raiseDispute } from '@/lib/solana/program';
import { requestAttestation } from '@/lib/solana/oracle';
import { lamportsToSol, paisaToInr, txExplorerUrl } from '@/lib/solana/utils';
import { TRADE_STATUS, ZERO_PUBKEY, ORACLE_PUBKEY_HEX } from '@/lib/constants';
import { UpiQrCode } from '@/components/UpiQrCode';
import { CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import type { SolanaTradeInfo } from '@/types';

const STATUS_CLS: Record<string, string> = {
  Active:    'status-badge--active',
  Released:  'status-badge--released',
  Disputed:  'status-badge--disputed',
  Cancelled: 'status-badge--cancelled',
  None:      'status-badge--none',
};

export default function TradeDetailPage() {
  const params = useParams();
  const tradeIdHex = ((params?.tradeId as string) ?? '').replace(/^0x/, '');
  const tradeIdBytes = tradeIdHex ? Buffer.from(tradeIdHex, 'hex') : null;

  const { connection } = useConnection();
  const wallet = useWallet();

  const [trade, setTrade] = useState<SolanaTradeInfo | null | undefined>(undefined);
  const [payerId, setPayerId] = useState('buyer@upi');
  const [utrNumber, setUtrNumber] = useState('UTR' + Date.now());
  const [sellerVpa, setSellerVpa] = useState('');
  const [releasing, setReleasing] = useState(false);
  const [releaseTx, setReleaseTx] = useState('');
  const [disputing, setDisputing] = useState(false);
  const [error, setError] = useState('');

  // Setu consent state
  const [aaId, setAaId] = useState('');
  const [setuConsentId, setSetuConsentId] = useState('');
  const [setuSessionId, setSetuSessionId] = useState('');
  const [setuUrl, setSetuUrl] = useState('');
  const [setuStep, setSetuStep] = useState<'idle' | 'creating' | 'waiting' | 'approved' | 'error'>('idle');

  const refreshTrade = () => {
    if (!tradeIdBytes || tradeIdBytes.length !== 32) { setTrade(null); return; }
    getTrade(connection, tradeIdBytes).then(setTrade).catch(() => setTrade(null));
  };

  useEffect(() => { refreshTrade(); }, [tradeIdHex, connection]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusLabel = trade ? (TRADE_STATUS[trade.status] ?? 'Unknown') : '—';
  const isActive    = trade?.status === 1;
  const isSeller    = wallet.publicKey && trade?.seller === wallet.publicKey.toBase58();
  const isBuyer     = wallet.publicKey && trade?.buyer  === wallet.publicKey.toBase58();
  const isOpen      = trade?.buyer === ZERO_PUBKEY;
  const isExpired   = trade && Number(trade.deadline) < Math.floor(Date.now() / 1000);
  const verificationMode = (process.env.NEXT_PUBLIC_VERIFICATION_MODE ?? 'mock').toLowerCase();

  const startSetuConsent = async () => {
    if (!aaId.trim()) { setError('Enter your AA handle (e.g. 9999999999@onemoney)'); return; }
    setError('');
    setSetuStep('creating');
    try {
      const res = await fetch('/api/setu/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aaId: aaId.trim(), redirectUrl: window.location.href }),
      });
      const data = (await res.json()) as { id?: string; url?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? 'Consent creation failed');
      setSetuConsentId(data.id);
      setSetuUrl(data.url ?? '');
      setSetuStep('waiting');
      pollConsent(data.id);
    } catch (e) {
      setError((e as Error).message);
      setSetuStep('error');
    }
  };

  const pollConsent = (id: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/setu/status?id=${id}`);
        const data = (await res.json()) as { status?: string; ready?: boolean; sessionId?: string; error?: string };
        if (data.status === 'ACTIVE') {
          if (data.sessionId) setSetuSessionId(data.sessionId);
          clearInterval(interval);
          setSetuStep('approved');
        } else if (data.status === 'REJECTED' || data.status === 'REVOKED' || data.status === 'FAILED') {
          clearInterval(interval);
          setError(`Consent ${data.status?.toLowerCase()} — please try again`);
          setSetuStep('error');
        }
      } catch { /* keep polling */ }
    }, 3000);
    // Stop polling after 10 minutes
    setTimeout(() => clearInterval(interval), 10 * 60_000);
  };

  const handleRelease = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !trade || !tradeIdBytes) return;
    setError('');
    setReleasing(true);
    try {
      const res = await requestAttestation({
        tradeId: tradeIdHex,
        inrAmount: String(trade.inrAmount),
        payerId,
        payeeId: sellerVpa || 'seller@upi',
        evidenceHash: utrNumber,
        utrNumber,
        ...(setuConsentId ? { consentId: setuConsentId } : {}),
        ...(setuSessionId ? { sessionId: setuSessionId } : {}),
      });

      const provider = new AnchorProvider(connection, wallet as AnchorWallet, { commitment: 'confirmed' });
      const oraclePubkey = res.oraclePubkey ?? ORACLE_PUBKEY_HEX;
      const sig = await releaseWithAttestation(provider, {
        tradeId: tradeIdBytes,
        trade,
        attestation: res.attestation,
        oraclePubkeyHex: oraclePubkey,
      });
      setReleaseTx(sig);
      setTimeout(refreshTrade, 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReleasing(false);
    }
  };

  const handleCancel = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !trade || !tradeIdBytes) return;
    setError('');
    try {
      const provider = new AnchorProvider(connection, wallet as AnchorWallet, { commitment: 'confirmed' });
      await cancelExpiredTrade(provider, { tradeId: tradeIdBytes, seller: trade.seller });
      setTimeout(refreshTrade, 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDispute = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !trade || !tradeIdBytes) return;
    setError('');
    setDisputing(true);
    try {
      const provider = new AnchorProvider(connection, wallet as AnchorWallet, { commitment: 'confirmed' });
      await raiseDispute(provider, { tradeId: tradeIdBytes });
      setTimeout(refreshTrade, 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDisputing(false);
    }
  };

  if (trade === undefined) {
    return <div className="app-card app-loading">Loading trade…</div>;
  }

  if (trade === null) {
    return (
      <div className="app-card app-empty">
        <p>Trade not found on Solana.</p>
        <Link href="/trade" className="app-link">← Back to market</Link>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div>
        <Link href="/trade" className="app-back-link">← P2P Market</Link>
        <h1 className="page-title" style={{ marginTop: '0.5rem' }}>Trade Details</h1>
        <p className="mono-sm" style={{ marginTop: '0.25rem' }}>{tradeIdHex.slice(0, 20)}…</p>
      </div>

      {/* Trade info */}
      <div className="app-card">
        <div className="trade-detail-header">
          <span>Status</span>
          <span className={`status-badge ${STATUS_CLS[statusLabel] ?? ''}`}>{statusLabel}</span>
        </div>
        <dl className="trade-detail-dl">
          <div className="trade-detail-row">
            <dt>SOL Amount</dt>
            <dd>{lamportsToSol(trade.lamports)} SOL</dd>
          </div>
          <div className="trade-detail-row">
            <dt>INR Amount</dt>
            <dd className="accent">₹{paisaToInr(trade.inrAmount)}</dd>
          </div>
          <div className="trade-detail-row">
            <dt>Seller</dt>
            <dd className="mono-sm">{trade.seller.slice(0, 16)}…</dd>
          </div>
          <div className="trade-detail-row">
            <dt>Buyer</dt>
            <dd className="mono-sm">{isOpen ? 'Open — not matched' : trade.buyer.slice(0, 16) + '…'}</dd>
          </div>
          {isActive && (
            <div className="trade-detail-row">
              <dt>Expires</dt>
              <dd className={isExpired ? 'text-danger' : ''}>
                {isExpired ? 'Expired' : new Date(Number(trade.deadline) * 1000).toLocaleString()}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Buyer: release flow */}
      {isActive && isBuyer && (
        <div className="app-card">
          <h3 className="card-title accent">Verify payment &amp; release SOL</h3>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Your UPI VPA (payer)</label>
              <input className="form-input" placeholder="buyer@upi" value={payerId} onChange={(e) => setPayerId(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">UTR / Reference number</label>
              <input className="form-input" placeholder="UTR412345678901" value={utrNumber} onChange={(e) => setUtrNumber(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Seller UPI VPA (payee)</label>
              <input className="form-input" placeholder="seller@hdfc" value={sellerVpa} onChange={(e) => setSellerVpa(e.target.value)} />
            </div>
          </div>
          {error && <p className="app-error">{error}</p>}

          {verificationMode === 'setu' && setuStep !== 'approved' && (
            <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid var(--rule)', borderRadius: 10, background: 'var(--bg)' }}>
              <p className="section-label" style={{ marginBottom: '0.5rem' }}>Step 1 — Verify via Setu AA</p>
              {setuStep === 'idle' && (
                <>
                  <div className="form-field" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label">Your AA handle</label>
                    <input className="form-input" placeholder="9999999999@onemoney" value={aaId} onChange={e => setAaId(e.target.value)} />
                  </div>
                  <button onClick={startSetuConsent} className="app-btn app-btn--primary">
                    Start Setu verification
                  </button>
                </>
              )}
              {setuStep === 'creating' && (
                <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-mute)' }}>
                  <Loader2 size={14} className="spin" style={{ display: 'inline', marginRight: 6 }} />
                  Creating consent…
                </p>
              )}
              {setuStep === 'waiting' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-mute)' }}>
                    <Loader2 size={14} className="spin" style={{ display: 'inline', marginRight: 6 }} />
                    Waiting for approval in your AA app…
                  </p>
                  {setuUrl && (
                    <a href={setuUrl} target="_blank" rel="noopener noreferrer" className="app-btn app-btn--ghost" style={{ width: 'fit-content' }}>
                      Open AA app <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              )}
              {setuStep === 'error' && (
                <button onClick={() => { setSetuStep('idle'); setError(''); }} className="app-btn app-btn--ghost">
                  Try again
                </button>
              )}
            </div>
          )}

          {verificationMode === 'setu' && setuStep === 'approved' && (
            <div className="app-success-banner" style={{ marginBottom: '1rem' }}>
              <CheckCircle size={18} />
              <p className="app-success-title">AA consent approved</p>
            </div>
          )}

          {releaseTx ? (
            <div className="app-success-banner">
              <CheckCircle size={20} />
              <div>
                <p className="app-success-title">SOL Released!</p>
                <a href={txExplorerUrl(releaseTx)} target="_blank" rel="noopener noreferrer" className="app-tx-link">
                  View tx <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ) : (
            <button
              onClick={handleRelease}
              disabled={releasing || (verificationMode === 'setu' && setuStep !== 'approved')}
              className="app-btn app-btn--primary"
            >
              {releasing && <Loader2 size={16} className="spin" />}
              {releasing ? 'Verifying & releasing…' : 'Get attestation & release SOL'}
            </button>
          )}
          <p className="form-hint">
            {verificationMode === 'mock'
              ? 'Mock mode: oracle auto-approves.'
              : 'Oracle verifies via Setu AA then releases on-chain.'}
          </p>
        </div>
      )}

      {/* Seller: show QR + cancel */}
      {isActive && isSeller && (
        <div className="app-card">
          <h3 className="card-title accent">Share payment QR with buyer</h3>
          <div className="form-field" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Your UPI VPA</label>
            <input className="form-input" placeholder="yourname@hdfc" value={sellerVpa} onChange={(e) => setSellerVpa(e.target.value)} />
          </div>
          {sellerVpa && (
            <UpiQrCode
              sellerVpa={sellerVpa}
              inrAmountRupees={(Number(trade.inrAmount) / 100).toFixed(2)}
              tradeId={tradeIdHex}
            />
          )}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            {isExpired && (
              <button onClick={handleCancel} className="app-btn app-btn--warning">
                Cancel expired trade (refund SOL)
              </button>
            )}
            {!isOpen && !isExpired && (
              <button onClick={handleDispute} disabled={disputing} className="app-btn app-btn--ghost">
                {disputing ? <Loader2 size={14} className="spin" /> : null}
                {disputing ? 'Raising dispute…' : 'Raise dispute'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Buyer: dispute option */}
      {isActive && isBuyer && !isOpen && (
        <div className="app-card">
          <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>Dispute</h3>
          <p className="form-hint" style={{ marginBottom: '1rem' }}>
            If the seller is unresponsive after you have paid, raise a dispute to freeze funds pending resolution.
          </p>
          <button onClick={handleDispute} disabled={disputing} className="app-btn app-btn--ghost">
            {disputing ? <Loader2 size={14} className="spin" /> : null}
            {disputing ? 'Raising dispute…' : 'Raise dispute'}
          </button>
          {error && <p className="app-error" style={{ marginTop: '0.5rem' }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
