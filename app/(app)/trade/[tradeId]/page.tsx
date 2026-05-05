'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@coral-xyz/anchor';
import type { AnchorWallet } from '@solana/wallet-adapter-react';
import { createHash } from 'crypto';
import { getTrade, cancelExpiredTrade, raiseDispute } from '@/lib/solana/program';
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

      {/* Buyer: QR → mobile → Setu → SOL */}
      {isActive && isBuyer && (
        <div className="app-card" ref={setuSectionRef}>
          <h3 className="card-title accent" style={{ marginBottom: '1.25rem' }}>Pay · verify · receive SOL</h3>

          {/* Seller UPI + QR */}
          {trimmedPayeeVpa ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <p style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-mute)', margin: 0 }}>Pay to</p>
              <p style={{ fontFamily: 'var(--mono)', fontSize: 17, color: 'var(--ink)', margin: 0, wordBreak: 'break-all', textAlign: 'center' }}>
                {trimmedPayeeVpa}
              </p>
              <p style={{ fontFamily: 'var(--mono)', fontSize: 36, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>
                ₹{paisaToInr(trade.inrAmount)}
              </p>
              <UpiQrCode
                sellerVpa={trimmedPayeeVpa}
                inrAmountRupees={(Number(trade.inrAmount) / 100).toFixed(2)}
                tradeId={tradeIdHex}
              />
              {payeeVpaMismatch && (
                <p className="form-hint" style={{ color: 'var(--danger, #c0392b)', textAlign: 'center' }}>
                  ⚠ VPA doesn&apos;t match on-chain hash — contact the seller
                </p>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: '1.5rem', padding: '1.25rem', border: '1px dashed var(--rule)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Loader2 size={16} className="spin" style={{ flexShrink: 0, color: 'var(--accent)' }} />
              <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-mute)', margin: 0 }}>
                Fetching seller payment details…
              </p>
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
            <div style={{ padding: '1rem', border: '1px solid var(--rule)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Loader2 size={16} className="spin" style={{ flexShrink: 0, color: 'var(--accent)' }} />
              <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-mute)', margin: 0 }}>
                {setuStep === 'approved' ? 'Setu verified — releasing SOL…' : 'Releasing SOL to your wallet…'}
              </p>
            </div>
          ) : setuStep === 'waiting' ? (
            <div style={{ padding: '1rem', border: '1px solid var(--rule)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Loader2 size={16} className="spin" style={{ flexShrink: 0, color: 'var(--accent)' }} />
              <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-mute)', margin: 0 }}>Waiting — approve consent in your bank&apos;s AA app…</p>
            </div>
          ) : setuStep === 'creating' ? (
            <div style={{ padding: '1rem', border: '1px solid var(--rule)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Loader2 size={16} className="spin" style={{ flexShrink: 0, color: 'var(--accent)' }} />
              <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-mute)', margin: 0 }}>Opening Setu…</p>
            </div>
          ) : verificationMode === 'mock' ? (
            <>
              {error && <p className="app-error" style={{ marginBottom: '0.75rem' }}>{error}</p>}
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
              {error && <p className="app-error" style={{ marginBottom: '0.75rem' }}>{error}</p>}
              <button onClick={startSetuConsent} disabled={buyerPhone.length !== 10} className="app-btn app-btn--primary app-btn--full">
                Verify with Setu →
              </button>
              {setuStep === 'error' && (
                <button onClick={() => { setSetuStep('idle'); setError(''); }} className="app-btn app-btn--ghost app-btn--full" style={{ marginTop: '0.5rem' }}>
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
          <p className="page-sub" style={{ marginTop: '0.5rem', maxWidth: 'none' }}>
            SOL is locked in escrow. Share this trade link (with your UPI embedded) — buyer sees your QR instantly
            and can pay + verify via Setu in one flow.
          </p>
          <div className="form-field" style={{ marginTop: '1rem', marginBottom: '0.75rem' }}>
            <label className="form-label">Your UPI VPA (to embed in share link)</label>
            <input
              className="form-input"
              placeholder="yourname@hdfc"
              value={sellerVpa}
              onChange={e => setSellerVpa(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <button type="button" onClick={copySellerTradeLink} className="app-btn app-btn--primary" disabled={!sellerVpa.trim()}>
              {sellerLinkCopied ? <Check size={14} /> : <Copy size={14} />}
              {sellerLinkCopied ? 'Copied' : 'Copy trade link'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
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
            <div style={{ marginTop: '1.25rem', padding: '1rem', border: '1px solid #22c55e', borderRadius: 10, background: 'color-mix(in oklab, #22c55e 8%, var(--bg))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <CheckCircle size={16} color="#22c55e" />
                <p style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#22c55e', margin: 0 }}>
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
              <p className="form-hint" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                SOL will be released to the buyer once on-chain attestation confirms.
              </p>
            </div>
          ) : (
            !isOpen && (
              <p className="form-hint" style={{ marginTop: '1rem' }}>
                Waiting for buyer to complete payment and Setu verification…
              </p>
            )
          )}
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
