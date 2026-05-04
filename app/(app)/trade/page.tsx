'use client';

import { useState } from 'react';
import { CreateOrder } from '@/components/CreateOrder';
import { OrderBook } from '@/components/OrderBook';
import { MatchOrder } from '@/components/MatchOrder';
import type { OpenOrder } from '@/types';

type Tab = 'buy' | 'sell';

export default function TradePage() {
  const [tab, setTab] = useState<Tab>('buy');
  const [matchingOrder, setMatchingOrder] = useState<OpenOrder | null>(null);

  return (
    <div className="page-stack">
      <div>
        <h1 className="page-title">P2P Market</h1>
        <p className="page-sub">
          Trustless SOL ↔ INR swaps on Solana. Seller locks SOL in escrow · buyer pays UPI · oracle verifies · vault auto-releases.
        </p>
      </div>

      {matchingOrder ? (
        <div className="app-card">
          <MatchOrder order={matchingOrder} onBack={() => setMatchingOrder(null)} />
        </div>
      ) : (
        <div className="page-stack">
          <div className="tab-bar">
            {(['buy', 'sell'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`tab-btn ${tab === t ? 'tab-btn--active' : ''}`}
              >
                {t === 'buy' ? 'Buy SOL' : 'Sell SOL'}
              </button>
            ))}
          </div>

          <div className="app-card">
            {tab === 'buy'
              ? <OrderBook onMatch={(order) => setMatchingOrder(order)} />
              : <CreateOrder />
            }
          </div>
        </div>
      )}
    </div>
  );
}
