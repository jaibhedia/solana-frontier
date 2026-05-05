'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface UpiQrCodeProps {
  sellerVpa: string;
  inrAmountRupees: string | number;
  tradeId: string;
  sellerName?: string;
}

export function UpiQrCode({ sellerVpa, inrAmountRupees, tradeId, sellerName = 'uWu Trade' }: UpiQrCodeProps) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const upiLink = `upi://pay?pa=${encodeURIComponent(sellerVpa)}&pn=${encodeURIComponent(sellerName)}&am=${inrAmountRupees}&tn=${encodeURIComponent('uWu:' + tradeId.slice(0, 16))}&cu=INR`;

  useEffect(() => {
    if (!sellerVpa || !inrAmountRupees) return;
    QRCode.toDataURL(upiLink, { width: 220, margin: 2, color: { dark: '#1a1410', light: '#faf7f2' } })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [upiLink, sellerVpa, inrAmountRupees]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(upiLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="upi-qr-card">
      <div style={{ textAlign: 'center' }}>
        <p className="upi-qr-label">Pay with UPI</p>
        <p className="upi-qr-sub">Scan or open in any UPI app</p>
      </div>
      <div className="upi-qr-img-wrap">
        {qrDataUrl
          ? <img src={qrDataUrl} alt={`UPI QR for ₹${inrAmountRupees} to ${sellerVpa}`} width={220} height={220} style={{ borderRadius: 8 }} />
          : <div style={{ width: 220, height: 220, background: 'var(--rule)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)' }}>generating…</span></div>
        }
      </div>
      <div style={{ textAlign: 'center' }}>
        <p className="upi-qr-amount">₹{Number(inrAmountRupees).toLocaleString('en-IN')}</p>
        <p className="upi-qr-vpa">{sellerVpa}</p>
      </div>
      <div className="upi-qr-actions">
        <button onClick={handleCopy} className="app-btn app-btn--ghost">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy UPI link'}
        </button>
        <a href={upiLink} className="app-btn app-btn--ghost" title="Open in UPI app">
          <ExternalLink size={14} /> Open in app
        </a>
      </div>
    </div>
  );
}
