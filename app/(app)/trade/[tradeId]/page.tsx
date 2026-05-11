'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@coral-xyz/anchor';
import type { AnchorWallet } from '@solana/wallet-adapter-react';
import { createHash } from 'crypto';
import { getTrade, findTradePda, cancelExpiredTrade, raiseDispute } from '@/lib/solana/program';
import { lamportsToSol, paisaToInr, txExplorerUrl } from '@/lib/solana/utils';
import { TRADE_STATUS, ZERO_PUBKEY } from '@/lib/constants';
import { UpiQrCode } from '@/components/UpiQrCode';
import { CheckCircle, Copy, Check, ExternalLink, Loader2 } from 'lucide-react';
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
  const searchParams = useSearchParams();
  const tradeIdHex = ((params?.tradeId as string) ?? '').replace(/^0x/, '');
  const tradeIdBytes = tradeIdHex ? Buffer.from(tradeIdHex, 'hex') : null;

  const { connection } = useConnection();
  const wallet = useWallet();

  const [trade, setTrade] = useState<SolanaTradeInfo | null | undefined>(undefined);
  const [payerId, setPayerId] = useState('buyer@upi');
  const [utrNumber] = useState('UTR' + Date.now());
  const [sellerVpa, setSellerVpa] = useState(searchParams.get('vpa') ?? '');
  const [releasing, setReleasing] = useState(false);
  const [releaseTx, setReleaseTx] = useState('');
  const [cancelTx, setCancelTx] = useState('');
  const [disputeTx, setDisputeTx] = useState('');
  const [disputing, setDisputing] = useState(false);
  const [error, setError] = useState('');

  // Setu consent state
  const [buyerPhone, setBuyerPhone] = useState('');
  const [setuConsentId, setSetuConsentId] = useState('');
  const [setuSessionId, setSetuSessionId] = useState('');
  const [setuStep, setSetuStep] = useState<'idle' | 'creating' | 'waiting' | 'approved' | 'error'>('idle');
  const [sellerLinkCopied, setSellerLinkCopied] = useState(false);
  const [buyerProof, setBuyerProof] = useState<{ buyerVpa: string; utrNumber: string; setuVerified: boolean } | null>(null);
  const setuSectionRef = useRef<HTMLDivElement | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling interval on unmount
  useEffect(() => () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); }, []);

  const refreshTrade = () => {
    if (!tradeIdBytes || tradeIdBytes.length !== 32) { setTrade(null); return; }
    getTrade(connection, tradeIdBytes).then(setTrade).catch(() => setTrade(null));
  };

  useEffect(() => { refreshTrade(); }, [tradeIdHex, connection]); // eslint-disable-line react-hooks/exhaustive-deps

  // When trade is already Released and we don't have the tx sig in state, fetch it from chain
  useEffect(() => {
    if (trade?.status !== 2 || releaseTx || !tradeIdBytes) return;
    try {
      const [tradePda] = findTradePda(tradeIdBytes);
      connection.getSignaturesForAddress(tradePda, { limit: 5 })
        .then(sigs => { if (sigs.length > 0) setReleaseTx(sigs[0].signature); })
        .catch(() => {});
    } catch {}
  }, [trade?.status, releaseTx, tradeIdHex, connection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (trade?.status !== 4 || cancelTx || !tradeIdBytes) return;
    try {
      const [tradePda] = findTradePda(tradeIdBytes);
      connection.getSignaturesForAddress(tradePda, { limit: 5 })
        .then(sigs => { if (sigs.length > 0) setCancelTx(sigs[0].signature); })
        .catch(() => {});
    } catch {}
  }, [trade?.status, cancelTx, tradeIdHex, connection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (trade?.status !== 3 || disputeTx || !tradeIdBytes) return;
    try {
      const [tradePda] = findTradePda(tradeIdBytes);
      connection.getSignaturesForAddress(tradePda, { limit: 5 })
        .then(sigs => { if (sigs.length > 0) setDisputeTx(sigs[0].signature); })
        .catch(() => {});
    } catch {}
  }, [trade?.status, disputeTx, tradeIdHex, connection]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusLabel = trade ? (TRADE_STATUS[trade.status] ?? 'Unknown') : '—';
  const isActive    = trade?.status === 1;
  const isSeller    = wallet.publicKey && trade?.seller === wallet.publicKey.toBase58();
  const isBuyer     = wallet.publicKey && trade?.buyer  === wallet.publicKey.toBase58();
  const isOpen      = trade?.buyer === ZERO_PUBKEY;
  const isExpired   = trade && Number(trade.deadline) < Math.floor(Date.now() / 1000);
  const verificationMode = (process.env.NEXT_PUBLIC_VERIFICATION_MODE ?? 'mock').toLowerCase();

  const trimmedPayeeVpa = sellerVpa.trim();
  const enteredPayeeHashHex = useMemo(() => {
    if (!trimmedPayeeVpa) return '';
    return Buffer.from(createHash('sha256').update(trimmedPayeeVpa).digest()).toString('hex');
  }, [trimmedPayeeVpa]);
  const payeeVpaMismatch =
    !!trade && !!trimmedPayeeVpa && enteredPayeeHashHex !== trade.payeeVpaHash;

  // Auto-submit buyer payment proof to server after Setu approval so seller can see it
  useEffect(() => {
    if (setuStep !== 'approved' || !payerId || !utrNumber || !tradeIdHex) return;
    fetch(`/api/trades/${tradeIdHex}/payment-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerVpa: payerId, utrNumber, setuVerified: true }),
    }).catch(() => {});
  }, [setuStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seller: poll for buyer payment proof every 8s
  useEffect(() => {
    if (!isSeller || !isActive || !tradeIdHex) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/trades/${tradeIdHex}/payment-proof`);
        if (res.ok) { setBuyerProof(await res.json()); clearInterval(id); }
      } catch { /* keep polling */ }
    };
    poll();
    const id = setInterval(poll, 8000);
    return () => clearInterval(id);
  }, [isSeller, isActive, tradeIdHex]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isBuyer || !trade) return;
    const focus = new URLSearchParams(window.location.search).get('focus');
    if (focus !== 'setu' || !setuSectionRef.current) return;
    const t = window.setTimeout(() => {
      setuSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
    return () => window.clearTimeout(t);
  }, [isBuyer, trade, tradeIdHex]);

  const copySellerTradeLink = async () => {
    const base = `${typeof window !== 'undefined' ? window.location.origin : ''}/trade/${tradeIdHex}`;
    const url = sellerVpa.trim() ? `${base}?vpa=${encodeURIComponent(sellerVpa.trim())}` : base;
    try {
      await navigator.clipboard.writeText(url);
      setSellerLinkCopied(true);
      setTimeout(() => setSellerLinkCopied(false), 2000);
    } catch { /* ignore */ }
  };

  // On client mount: restore VPA from localStorage if URL param was stripped (e.g. after MatchOrder redirect)
  useEffect(() => {
    if (sellerVpa.trim()) return;
    const stored = localStorage.getItem(`uwu_vpa_${tradeIdHex}`);
    if (stored) setSellerVpa(stored);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist VPA to both localStorage and Redis whenever it's resolved
  useEffect(() => {
    if (!tradeIdHex || !sellerVpa.trim()) return;
    localStorage.setItem(`uwu_vpa_${tradeIdHex}`, sellerVpa.trim());
    fetch(`/api/trades/${tradeIdHex}/vpa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vpa: sellerVpa.trim() }),
    }).catch(() => {});
  }, [sellerVpa, tradeIdHex]);

  // Poll Redis for seller VPA every 5 s until found (handles case where CreateOrder write failed
  // and seller hasn't shared ?vpa= link — buyer sees QR as soon as seller visits their trade page)
  useEffect(() => {
    if (!tradeIdHex || sellerVpa.trim()) return;
    let active = true;
    const poll = async (): Promise<void> => {
      if (!active) return;
      try {
        const r = await fetch(`/api/trades/${tradeIdHex}/vpa`);
        if (r.ok && active) {
          const d = await r.json();
          if (d.vpa) { setSellerVpa(String(d.vpa)); active = false; return; }
        }
      } catch { /* ignore */ }
      if (active) setTimeout(poll, 5000);
    };
    poll();
    const giveUp = setTimeout(() => { active = false; }, 3 * 60_000);
    return () => { active = false; clearTimeout(giveUp); };
  }, [tradeIdHex]); // eslint-disable-line react-hooks/exhaustive-deps

  // On mount: resume pending Setu consent (localStorage primary, URL ?id= fallback for Setu redirect)
  useEffect(() => {
    if (typeof window === 'undefined' || !isBuyer || !isActive || !tradeIdHex || setuStep !== 'idle') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get('id') ?? '';
      const raw = localStorage.getItem(`uwu_setu_${tradeIdHex}`);
      const pending = raw ? JSON.parse(raw) as { consentId: string; buyerVpa?: string } : null;
      const consentId = pending?.consentId || urlId;
      if (!consentId) return;

      // Setu redirected back with failure — clear and show error, don't poll
      if (params.get('success') === 'false') {
        localStorage.removeItem(`uwu_setu_${tradeIdHex}`);
        const msg = params.get('errormsg') ?? 'cancelled';
        setError(`Setu: ${msg.replace(/_/g, ' ')} — please try again`);
        setSetuStep('error');
        return;
      }

      setSetuConsentId(consentId);
      if (pending?.buyerVpa) setPayerId(pending.buyerVpa);
      setSetuStep('waiting');
      pollConsent(consentId);
    } catch { /* ignore */ }
  }, [isBuyer, isActive, tradeIdHex]); // eslint-disable-line react-hooks/exhaustive-deps

  const startSetuConsent = async () => {
    const phone = buyerPhone.trim();
    if (!phone || phone.length !== 10 || !/^\d+$/.test(phone)) {
      setError('Enter your 10-digit mobile number');
      return;
    }
    if (!trimmedPayeeVpa) {
      setError('Paste the seller\'s UPI ID in the field above first');
      return;
    }
    setError('');
    setSetuStep('creating');
    try {
      const res = await fetch('/api/setu/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aaId: `${phone}@onemoney`, redirectUrl: window.location.href }),
      });
      const data = (await res.json()) as { id?: string; url?: string; error?: string };
      if (!res.ok || !data.id || !data.url) throw new Error(data.error ?? 'Consent creation failed');
      // Persist before redirect so we can resume when Setu sends user back
      localStorage.setItem(`uwu_setu_${tradeIdHex}`, JSON.stringify({ consentId: data.id, buyerVpa: payerId }));
      setSetuConsentId(data.id);
      // Full-page redirect — Setu will redirect back to this URL
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
      setSetuStep('error');
    }
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
  };

  const pollConsent = (id: string) => {
    stopPolling();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/setu/status?id=${id}`);
        const data = (await res.json()) as { status?: string; sessionId?: string };
        const st = (data.status ?? '').toUpperCase();
        if (st === 'ACTIVE') {
          if (data.sessionId) setSetuSessionId(data.sessionId);
          stopPolling();
          localStorage.removeItem(`uwu_setu_${tradeIdHex}`);
          setSetuStep('approved');
        } else if (['REJECTED', 'REVOKED', 'FAILED', 'EXPIRED', 'PAUSED'].includes(st)) {
          stopPolling();
          localStorage.removeItem(`uwu_setu_${tradeIdHex}`);
          setError(`Consent ${st.toLowerCase()} — please try again`);
          setSetuStep('error');
        }
      } catch { /* keep polling */ }
    }, 3000);
    // Hard stop after 10 min regardless
    setTimeout(stopPolling, 10 * 60_000);
  };

  // Auto-release after Setu approval — backend submits release tx with oracle keypair
  // (program does not require buyer to sign; only oracle's attestation matters)
  useEffect(() => {
    if (setuStep !== 'approved' || releaseTx || releasing || !tradeIdHex) return;
    setReleasing(true);
    setError('');
    fetch('/api/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tradeId: tradeIdHex,
        payerId,
        payeeId: sellerVpa || 'seller@upi',
        utrNumber,
        evidenceHash: utrNumber,
        ...(setuConsentId ? { consentId: setuConsentId } : {}),
        ...(setuSessionId ? { sessionId: setuSessionId } : {}),
      }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d.signature) throw new Error(d.error ?? 'Release failed');
        setReleaseTx(d.signature);
        setTimeout(refreshTrade, 3000);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setReleasing(false));
  }, [setuStep]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !trade || !tradeIdBytes) return;
    setError('');
    try {
      const provider = new AnchorProvider(connection, wallet as AnchorWallet, { commitment: 'confirmed' });
      const sig = await cancelExpiredTrade(provider, { tradeId: tradeIdBytes, seller: trade.seller });
      if (sig) setCancelTx(sig);
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
      const sig = await raiseDispute(provider, { tradeId: tradeIdBytes });
      if (sig) setDisputeTx(sig);
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
        <h1 className="page-title mt-2">Trade Details</h1>
        <p className="mono-sm mt-1">{tradeIdHex.slice(0, 20)}…</p>
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
          {(trade?.status === 2 || releaseTx) && (
            <div className="trade-detail-row">
              <dt>Release Tx</dt>
              <dd>
                {releaseTx ? (
                  <a href={txExplorerUrl(releaseTx)} target="_blank" rel="noopener noreferrer" className="app-tx-link">
                    {releaseTx.slice(0, 12)}…{releaseTx.slice(-6)} <ExternalLink size={11} />
                  </a>
                ) : (
                  <span className="mono-sm" style={{ opacity: 0.5 }}>fetching…</span>
                )}
              </dd>
            </div>
          )}
          {cancelTx && (
            <div className="trade-detail-row">
              <dt>Cancel Tx</dt>
              <dd>
                <a href={txExplorerUrl(cancelTx)} target="_blank" rel="noopener noreferrer" className="app-tx-link">
                  {cancelTx.slice(0, 12)}…{cancelTx.slice(-6)} <ExternalLink size={11} />
                </a>
              </dd>
            </div>
          )}
          {disputeTx && (
            <div className="trade-detail-row">
              <dt>Dispute Tx</dt>
              <dd>
                <a href={txExplorerUrl(disputeTx)} target="_blank" rel="noopener noreferrer" className="app-tx-link">
                  {disputeTx.slice(0, 12)}…{disputeTx.slice(-6)} <ExternalLink size={11} />
                </a>
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Buyer: QR → mobile → Setu → SOL */}
      {isActive && isBuyer && (
        <div className="app-card" ref={setuSectionRef}>
          <h3 className="card-title accent mb-5">Pay · verify · receive SOL</h3>

          {/* Seller UPI + QR */}
          {trimmedPayeeVpa ? (
            <div className="upi-pay-header">
              <p className="upi-pay-label">Pay to</p>
              <p className="upi-pay-vpa">{trimmedPayeeVpa}</p>
              <p className="upi-pay-amount">₹{paisaToInr(trade.inrAmount)}</p>
              <UpiQrCode
                sellerVpa={trimmedPayeeVpa}
                inrAmountRupees={(Number(trade.inrAmount) / 100).toFixed(2)}
                tradeId={tradeIdHex}
              />
              {payeeVpaMismatch && (
                <p className="form-hint upi-pay-mismatch">
                  ⚠ VPA doesn&apos;t match on-chain hash — contact the seller
                </p>
              )}
            </div>
          ) : (
            <div className="vpa-wait-box">
              <Loader2 size={16} className="spin status-box-spin" />
              <p>Fetching seller payment details…</p>
            </div>
          )}

          {/* Verify / status */}
          {releaseTx ? (
            <div className="app-success-banner">
              <CheckCircle size={20} />
              <div>
                <p className="app-success-title">SOL released to your wallet!</p>
                <a href={txExplorerUrl(releaseTx)} target="_blank" rel="noopener noreferrer" className="app-tx-link">
                  View tx <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ) : releasing || setuStep === 'approved' ? (
            <div className="status-box">
              <Loader2 size={16} className="spin status-box-spin" />
              <p>{setuStep === 'approved' ? 'Setu verified — releasing SOL…' : 'Releasing SOL to your wallet…'}</p>
            </div>
          ) : setuStep === 'waiting' ? (
            <div className="status-box">
              <Loader2 size={16} className="spin status-box-spin" />
              <p>Waiting — approve consent in your bank&apos;s AA app…</p>
            </div>
          ) : setuStep === 'creating' ? (
            <div className="status-box">
              <Loader2 size={16} className="spin status-box-spin" />
              <p>Opening Setu…</p>
            </div>
          ) : verificationMode === 'mock' ? (
            <>
              {error && <p className="app-error mb-3">{error}</p>}
              <button
                onClick={() => {
                  setReleasing(true); setError('');
                  fetch('/api/release', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tradeId: tradeIdHex, payerId, payeeId: sellerVpa || 'seller@upi', utrNumber, evidenceHash: utrNumber }) })
                    .then(async r => { const d = await r.json(); if (!r.ok || !d.signature) throw new Error(d.error ?? 'Release failed'); setReleaseTx(d.signature); setTimeout(refreshTrade, 3000); })
                    .catch(e => setError(e instanceof Error ? e.message : String(e)))
                    .finally(() => setReleasing(false));
                }}
                className="app-btn app-btn--primary app-btn--full"
              >Release SOL (mock)</button>
            </>
          ) : (
            <>
              <div className="form-field" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Your mobile number</label>
                <input
                  className="form-input"
                  placeholder="9999999999"
                  maxLength={10}
                  value={buyerPhone}
                  onChange={e => setBuyerPhone(e.target.value.replace(/\D/g, ''))}
                />
                <p className="form-hint">Setu verifies the UPI debit from your bank account · test: 9999999999</p>
              </div>
              {error && <p className="app-error mb-3">{error}</p>}
              <button onClick={startSetuConsent} disabled={buyerPhone.length !== 10} className="app-btn app-btn--primary app-btn--full">
                Verify with Setu →
              </button>
              {setuStep === 'error' && (
                <button onClick={() => { setSetuStep('idle'); setError(''); }} className="app-btn app-btn--ghost app-btn--full mt-2">
                  Try again
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Seller: waiting — no QR (buyer pays from trade page) */}
      {isActive && isSeller && (
        <div className="app-card">
          <h3 className="card-title accent">Listing live — waiting for buyer</h3>
          <p className="page-sub mt-2" style={{ maxWidth: 'none' }}>
            SOL is locked in escrow. Share this trade link (with your UPI embedded) — buyer sees your QR instantly
            and can pay + verify via Setu in one flow.
          </p>
          <div className="form-field mt-4 mb-3">
            <label className="form-label">Your UPI VPA (to embed in share link)</label>
            <input
              className="form-input"
              placeholder="yourname@hdfc"
              value={sellerVpa}
              onChange={e => setSellerVpa(e.target.value)}
            />
          </div>
          <div className="seller-share-row">
            <button type="button" onClick={copySellerTradeLink} className="app-btn app-btn--primary" disabled={!sellerVpa.trim()}>
              {sellerLinkCopied ? <Check size={14} /> : <Copy size={14} />}
              {sellerLinkCopied ? 'Copied' : 'Copy trade link'}
            </button>
          </div>
          <div className="seller-action-row">
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

          {buyerProof ? (
            <div className="buyer-proof-box">
              <div className="buyer-proof-head">
                <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
                <p className="buyer-proof-label">
                  {buyerProof.setuVerified ? 'Payment received · Setu verified' : 'Payment submitted by buyer'}
                </p>
              </div>
              <dl className="trade-detail-dl">
                <div className="trade-detail-row">
                  <dt>Buyer UPI VPA</dt>
                  <dd className="mono-sm">{buyerProof.buyerVpa}</dd>
                </div>
                <div className="trade-detail-row">
                  <dt>UTR / Reference</dt>
                  <dd className="mono-sm">{buyerProof.utrNumber}</dd>
                </div>
              </dl>
              <p className="form-hint mt-2" style={{ marginBottom: 0 }}>
                SOL will be released to the buyer once on-chain attestation confirms.
              </p>
            </div>
          ) : (
            !isOpen && (
              <p className="form-hint mt-4">
                Waiting for buyer to complete payment and Setu verification…
              </p>
            )
          )}
        </div>
      )}

      {/* Buyer: dispute option */}
      {isActive && isBuyer && !isOpen && (
        <div className="app-card">
          <h3 className="card-title mb-3">Dispute</h3>
          <p className="form-hint mb-4">
            If the seller is unresponsive after you have paid, raise a dispute to freeze funds pending resolution.
          </p>
          <button onClick={handleDispute} disabled={disputing} className="app-btn app-btn--ghost">
            {disputing ? <Loader2 size={14} className="spin" /> : null}
            {disputing ? 'Raising dispute…' : 'Raise dispute'}
          </button>
          {error && <p className="app-error mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
