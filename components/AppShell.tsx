'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ThemeToggle } from '@/components/ThemeToggle';
import { WalletButton } from '@/components/WalletButton';

// ssr: false — Admin link depends on wallet state; rendering it server-side causes hydration mismatch
const AdminNavLink = dynamic(() => import('./AdminNavLink'), { ssr: false });

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/trade',     label: 'P2P Market' },
  { href: '/explorer',  label: 'Explorer' },
  { href: '/tax',       label: 'Tax' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="app-nav-inner">
          <Link href="/" className="app-nav-logo">
            <span className="app-nav-logo-seal" aria-hidden="true"></span>
            <span className="app-nav-logo-text">u<em>W</em>u</span>
            <span className="app-nav-logo-sub">Protocol</span>
          </Link>

          <div className="app-nav-links">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`app-nav-link ${pathname === item.href ? 'app-nav-link--active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
            <AdminNavLink />
          </div>

          <div className="app-nav-wallet">
            <div className="app-nav-actions">
              <ThemeToggle />
              <WalletButton className="wallet-btn" />
            </div>
          </div>
        </div>
      </nav>

      <main className="app-main">
        <div className="app-content">{children}</div>
      </main>

      <footer className="app-footer">
        <p>uWu Protocol · Solana Devnet · <Link href="/" className="app-footer-link">Back to landing</Link></p>
      </footer>
    </div>
  );
}
