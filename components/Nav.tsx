import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Nav() {
  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <a href="#" className="brand">
          <span className="seal" aria-hidden="true"></span>
          <span>u<em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>W</em>u Protocol</span>
        </a>
        <nav className="nav-links">
          <a href="#how">How it works</a>
          <a href="#explorer">Explorer</a>
          <a href="#waitlist">Waitlist</a>
          <a href="#docs">Docs</a>
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          <Link href="/dashboard" className="nav-cta">Open app →</Link>
        </div>
      </div>
    </header>
  );
}
