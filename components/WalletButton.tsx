'use client';

import { useState, useEffect } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

type WMBProps = { className?: string };

export function WalletButton({ className }: WMBProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <span className="wallet-btn wallet-btn--placeholder" aria-hidden />;
  return <WalletMultiButton className={className} />;
}
