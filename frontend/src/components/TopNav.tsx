'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, Bot, GitFork, Activity, Database } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useSearchParams } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/?tab=events', id: 'events', label: 'Map Explorer', icon: Map },
  { href: '/?tab=kg', id: 'kg', label: 'Knowledge Graph', icon: GitFork },
];

const API_BASE = 'http://127.0.0.1:8000';

export function TopNavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [apiUp, setApiUp] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
        if (!cancelled) setApiUp(res.ok);
      } catch {
        if (!cancelled) setApiUp(false);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const isChecking = apiUp === null;
  const status = apiUp ? 'up' : 'down';
  const currentTab = searchParams.get('tab') || 'events';

  return (
    <nav className="top-nav">
      <div className="top-nav-brand">
        <img src="/grandstand_logo.png" alt="GrandStand" className="top-nav-logo" />
        <span className="top-nav-title">GrandStand</span>
        <span className="top-nav-badge">Backend</span>
      </div>
      {/* Center: Routes */}
      <ul className="top-nav-links">
        {NAV_ITEMS.map((link) => {
          const Icon = link.icon;
          const isActive = currentTab === link.id;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`top-nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon />
                {link.label}
              </Link>
            </li>
          );
        })}
        <li>
          <a
            href="http://localhost:5050"
            target="_blank"
            rel="noopener noreferrer"
            className="top-nav-link"
          >
            <Database size={16} />
            PgAdmin
          </a>
        </li>
      </ul>

      {/* Right: Status & Env */}
      <div className="top-nav-status">
        <span style={{
          fontSize: '0.625rem',
          fontWeight: 700,
          padding: '0.125rem 0.375rem',
          borderRadius: '4px',
          background: 'rgba(212, 175, 55, 0.2)', // DEV color (gold)
          color: 'var(--accent)',
          marginRight: 'var(--space-4)'
        }}>DEV</span>
        <div className={`top-nav-status-dot ${isChecking ? 'checking' : status}`} />
        <span className="top-nav-status-label">
          {isChecking ? 'Checking API...' : status === 'up' ? 'API Connected' : 'API Offline'}
        </span>
      </div>
    </nav>
  );
}

import { Suspense } from 'react';

export default function TopNav() {
  return (
    <Suspense fallback={<nav className="top-nav"><div className="top-nav-brand"><span className="top-nav-title">GrandStand</span></div></nav>}>
      <TopNavContent />
    </Suspense>
  );
}
