'use client';

import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { usePathname } from 'next/navigation';
import { ADMIN_PUBKEY } from '@/lib/constants';

export default function AdminNavLink() {
  const { publicKey } = useWallet();
  const pathname = usePathname();
  if (publicKey?.toBase58() !== ADMIN_PUBKEY) return null;
  return (
    <Link
      href="/admin"
      className={`app-nav-link ${pathname === '/admin' ? 'app-nav-link--active' : ''}`}
    >
      Admin
    </Link>
  );
}
