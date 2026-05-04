'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Connection } from '@solana/web3.js';
import { getTrade } from '@/lib/solana/program';
import { lamportsToSol, paisaToInr, formatAddress, accountExplorerUrl } from '@/lib/solana/utils';
import { SOLANA_RPC, TRADE_STATUS, ZERO_PUBKEY } from '@/lib/constants';

const PAGE_SIZE = 20;
const FILTER_TABS = ['All', 'Active', 'Released', 'Disputed', 'Cancelled'] as const;
type FilterTab = (typeof FILTER_TABS)[number];

type TradeRow = {
  tradeIdHex: string;
  pubkey: string;
  seller: string;
  buyer: string;
  solStr: string;
  inrStr: string;
  status: number;
  createdAt: number;
};

export function ExplorerTable() {
  const [rows, setRows]       = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lookupId, setLookupId] = useState('');
  const [filter, setFilter]   = useState<FilterTab>('All');
  const [page, setPage]       = useState(1);

  async function loadTrades() {
    try {
      const res  = await fetch('/api/trades');
      const data = await res.json();
      const mapped: TradeRow[] = (data.trades ?? []).map((t: {
        tradeId: string; pubkey: string; seller: string; buyer: string;
        lamports: string; inrAmount: string; status: number; createdAt: number;
      }) => ({
        tradeIdHex: t.tradeId,
        pubkey:     t.pubkey,
        seller:     formatAddress(t.seller),
        buyer:      t.buyer === ZERO_PUBKEY ? ZERO_PUBKEY : formatAddress(t.buyer),
        solStr:     lamportsToSol(BigInt(t.lamports)),
        inrStr:     paisaToInr(BigInt(t.inrAmount)),
        status:     t.status,
        createdAt:  t.createdAt,
      }));
      setRows(mapped);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    loadTrades();
    const t = setInterval(loadTrades, 15_000);
    return () => clearInterval(t);
  }, []);

  const handleLookup = async () => {
    const hex = lookupId.replace(/^0x/, '').trim();
    if (hex.length !== 64) return;
    const connection = new Connection(SOLANA_RPC, 'confirmed');
    const trade = await getTrade(connection, Buffer.from(hex, 'hex')).catch(() => null);
    if (!trade) return;
    const row: TradeRow = {
      tradeIdHex: hex,
      pubkey:     '',
      seller:     formatAddress(trade.seller),
      buyer:      trade.buyer === ZERO_PUBKEY ? ZERO_PUBKEY : formatAddress(trade.buyer),
      solStr:     lamportsToSol(trade.lamports),
      inrStr:     paisaToInr(trade.inrAmount),
      status:     trade.status,
      createdAt:  0,
    };
    setRows(prev => [row, ...prev.filter(r => r.tradeIdHex !== hex)]);
  };

  const filtered = useMemo(() => {
    if (filter === 'All') return rows;
    const idx = FILTER_TABS.indexOf(filter);
    return rows.filter(r => r.status === idx);
  }, [rows, filter]);

  const paginated = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);

  return (
    <div className="explorer-table-wrap">
      <div className="explorer-lookup">
        <input
          className="form-input"
          placeholder="Lookup by trade ID (64-char hex)"
          value={lookupId}
          onChange={e => setLookupId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLookup()}
        />
        <button onClick={handleLookup} className="app-btn app-btn--primary">Lookup</button>
        <button onClick={loadTrades} className="app-btn app-btn--ghost" title="Refresh">↻ Refresh</button>
      </div>

      <div className="explorer-filters">
        {FILTER_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => { setFilter(tab); setPage(1); }}
            className={`explorer-filter-btn ${filter === tab ? 'explorer-filter-btn--active' : ''}`}
          >{tab}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
          {loading ? 'syncing…' : `${rows.length} trade${rows.length !== 1 ? 's' : ''} on-chain`}
        </span>
      </div>

      {loading ? (
        <div className="app-loading">Reading from Solana devnet…</div>
      ) : (
        <>
          <div className="explorer-scroll">
            <table className="explorer-tbl">
              <thead>
                <tr>
                  <th>Trade ID</th>
                  <th>Seller</th>
                  <th>Buyer</th>
                  <th>SOL</th>
                  <th>INR</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={6} className="explorer-empty">
                      No trades found on-chain.{' '}
                      <Link href="/trade" className="app-link">Create the first one →</Link>
                    </td>
                  </tr>
                )}
                {paginated.map(t => (
                  <tr key={t.tradeIdHex}>
                    <td>
                      <Link href={`/trade/${t.tradeIdHex}`} className="explorer-trade-link">
                        0x{t.tradeIdHex.slice(0, 8)}…
                      </Link>
                      {t.pubkey && (
                        <a
                          href={accountExplorerUrl(t.pubkey)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="explorer-ext-link"
                          title="View on Solana Explorer"
                        >↗</a>
                      )}
                    </td>
                    <td className="explorer-addr">{t.seller}</td>
                    <td className="explorer-addr">
                      {t.buyer === ZERO_PUBKEY ? <span style={{ color: 'var(--accent)' }}>Open</span> : t.buyer}
                    </td>
                    <td>{t.solStr} SOL</td>
                    <td>₹{t.inrStr}</td>
                    <td>
                      <span className={`status-badge status-badge--${TRADE_STATUS[t.status]?.toLowerCase() ?? 'unknown'}`}>
                        {TRADE_STATUS[t.status] ?? 'Unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > paginated.length && (
            <div className="explorer-load-more">
              <button onClick={() => setPage(p => p + 1)} className="app-btn app-btn--ghost">
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
