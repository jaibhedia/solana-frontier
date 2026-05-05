'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
import { clusterApiUrl } from '@solana/web3.js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  ConnectionProvider as _ConnectionProvider,
  WalletProvider as _WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider as _WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { SOLANA_RPC } from '@/lib/constants';

// Type-cast the wallet adapter components to avoid React-18 FC return type mismatch
const ConnectionProvider = _ConnectionProvider as any;
const WalletProvider = _WalletProvider as any;
const WalletModalProvider = _WalletModalProvider as any;

import '@solana/wallet-adapter-react-ui/styles.css';

export function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  const endpoint = SOLANA_RPC || clusterApiUrl(WalletAdapterNetwork.Devnet);
  // Phantom self-registers as a Standard Wallet — no adapter needed
  const wallets = useMemo(() => [new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
