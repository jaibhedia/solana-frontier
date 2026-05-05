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
          Seller locks SOL on-chain once. Buyer matches, pays INR (UPI on the trade page), completes Setu when enabled,
          then releases SOL to their wallet.
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
                className={`tab-btn tab-btn--${t} ${tab === t ? 'tab-btn--active' : ''}`}
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
