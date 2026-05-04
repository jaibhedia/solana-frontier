'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface UpiQrCodeProps {
  sellerVpa: string;
  inrAmountRupees: string | number;
  tradeId: string;
  sellerName?: string;
}

export function UpiQrCode({ sellerVpa, inrAmountRupees, tradeId, sellerName = 'uWu Trade' }: UpiQrCodeProps) {
  const [copied, setCopied] = useState(false);

  const upiLink = `upi://pay?pa=${encodeURIComponent(sellerVpa)}&pn=${encodeURIComponent(sellerName)}&am=${inrAmountRupees}&tn=${encodeURIComponent('uWu:' + tradeId.slice(0, 16))}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(upiLink)}`;

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
        <p className="upi-qr-label">UPI Payment QR</p>
        <p className="upi-qr-sub">Share with buyer — money goes directly to your bank</p>
      </div>
      <div className="upi-qr-img-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrUrl} alt={`UPI QR for ₹${inrAmountRupees} to ${sellerVpa}`} width={200} height={200} />
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
      <p className="upi-qr-note">Trade note embeds the trade ID for automatic oracle verification</p>
    </div>
  );
}
