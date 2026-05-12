'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { COUNTRY_CONFIG, calculateTaxLines, formatFiat } from '@/lib/tax';
import { generateTaxReportPdf } from '@/lib/taxReport';
import { txExplorerUrl } from '@/lib/solana/utils';
import { useUserPrefs } from '@/contexts/UserPrefsContext';
import type { TxnRecord } from '@/types';

const COUNTRIES = Object.entries(COUNTRY_CONFIG).map(([code, cfg]) => ({ code, ...cfg }));

// ── India surcharge ────────────────────────────────────────────────────────────
const SURCHARGE_SLABS = [
  { limit: 5_000_000,  rate: 0,    label: 'Nil (income ≤ ₹50L)' },
  { limit: 10_000_000, rate: 0.10, label: '10% (₹50L – ₹1Cr)' },
  { limit: 20_000_000, rate: 0.15, label: '15% (₹1Cr – ₹2Cr)' },
  { limit: 50_000_000, rate: 0.25, label: '25% (₹2Cr – ₹5Cr)' },
  { limit: Infinity,   rate: 0.37, label: '37% (above ₹5Cr)' },
];
function surchargeRate(income: number) {
  return SURCHARGE_SLABS.find(s => income <= s.limit)?.rate ?? 0.37;
}

function fmt(n: number, locale = 'en-IN') {
  return n.toLocaleString(locale, { maximumFractionDigits: 2 });
}
function fmtCurrency(n: number, country: string) {
  const cfg = COUNTRY_CONFIG[country];
  return cfg ? `${cfg.symbol}${fmt(n, cfg.locale)}` : String(n);
}

export default function TaxPage() {
  const { publicKey } = useWallet();
  const { prefs, setCountry } = useUserPrefs();

  // Local override — initialised from persisted prefs, falls back to 'IN'
  const [country, setLocalCountry] = useState<string>(prefs.country ?? 'IN');
  const [records, setRecords] = useState<TxnRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Sync when prefs load from Redis (may arrive after mount)
  useEffect(() => {
    if (prefs.country) setLocalCountry(prefs.country);
  }, [prefs.country]);

  function pickCountry(c: string) {
    setLocalCountry(c);
    setCountry(c); // persists to localStorage + Redis
  }

  // Fetch transaction history
  useEffect(() => {
    if (!publicKey) return;
    setLoading(true);
    fetch(`/api/txns?wallet=${publicKey.toBase58()}&limit=50`)
      .then(r => r.json())
      .then(d => setRecords(d.records ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [publicKey]);

  const cfg = COUNTRY_CONFIG[country];
  const thisYear = new Date().getFullYear();

  const countryRecords = useMemo(() =>
    records.filter(r =>
      r.country === country &&
      new Date(r.releasedAt).getFullYear() === thisYear,
    ),
  [records, country, thisYear]);

  const perTradeTaxTotal = useMemo(() =>
    countryRecords.reduce((sum, r) =>
      sum + r.taxes.filter(t => t.applicable).reduce((s, t) => s + t.amountMinor, 0), 0),
  [countryRecords]);

  const totalFiatVolume = useMemo(() =>
    countryRecords.reduce((s, r) => s + r.fiatAmountMinor, 0),
  [countryRecords]);

  const [downloading, setDownloading] = useState(false);

  const downloadReport = useCallback(async () => {
    if (!publicKey || downloading) return;
    setDownloading(true);
    try {
      const bytes = await generateTaxReportPdf(countryRecords, country, publicKey.toBase58());
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tax-report-${country}-${thisYear}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [countryRecords, country, publicKey, thisYear, downloading]);

  // Manual calculator state
  const [solAmount, setSolAmount] = useState('1');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [annualIncome, setAnnualIncome] = useState('500000');
  const [tdsAmount, setTdsAmount] = useState('');

  const indiaCalc = useMemo(() => {
    if (country !== 'IN') return null;
    const qty    = parseFloat(solAmount) || 0;
    const buy    = parseFloat(buyPrice)  || 0;
    const sell   = parseFloat(sellPrice) || 0;
    const income = parseFloat(annualIncome) || 0;
    const cost   = qty * buy;
    const proceeds = qty * sell;
    const gain   = proceeds - cost;
    const isGain = gain > 0;
    const taxableGain = isGain ? gain : 0;
    const base   = taxableGain * 0.30;
    const sRate  = surchargeRate(income);
    const surcharge = base * sRate;
    const cess   = (base + surcharge) * 0.04;
    const total  = base + surcharge + cess;
    const effective = taxableGain > 0 ? (total / taxableGain) * 100 : 0;
    const tds    = proceeds * 0.01;
    return { qty, cost, proceeds, gain, isGain, taxableGain, base, surcharge, cess, total, effective, tds, sRate };
  }, [country, solAmount, buyPrice, sellPrice, annualIncome]);

  const genericCalc = useMemo(() => {
    if (country === 'IN') return null;
    const qty  = parseFloat(solAmount) || 0;
    const buy  = parseFloat(buyPrice)  || 0;
    const sell = parseFloat(sellPrice) || 0;
    const cost = qty * buy;
    const proceeds = qty * sell;
    const gain = proceeds - cost;
    const taxLines = calculateTaxLines(Math.round(proceeds * 100), country).filter(t => !t.applicable);
    return { qty, cost, proceeds, gain, taxLines };
  }, [country, solAmount, buyPrice, sellPrice]);

  const tdsSolo = useMemo(() => {
    const val = parseFloat(tdsAmount) || 0;
    return { tds: val * 0.01, net: val * 0.99 };
  }, [tdsAmount]);

  const hasInputs = !!buyPrice && !!sellPrice;

  return (
    <div className="page-stack">
      {/* Header */}
      <div>
        <Link href="/dashboard" className="app-back-link">← Dashboard</Link>
        <h1 className="page-title" style={{ marginTop: '0.5rem' }}>Crypto Tax Calculator</h1>
        <p className="page-sub">Local tax obligations for your SOL trades · For informational purposes only</p>
      </div>

      {/* Country onboarding prompt — shown only when never set */}
      {prefs.country === null && (
        <div className="app-card" style={{ borderColor: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 6%, var(--surface))' }}>
          <p className="section-label" style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}>
            Where are you based?
          </p>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: '0.75rem' }}>
            We&apos;ll save your jurisdiction and automatically apply the right tax rules to all your trades.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {COUNTRIES.map(c => (
              <button
                key={c.code}
                onClick={() => pickCountry(c.code)}
                style={{
                  padding: '0.4rem 0.85rem', borderRadius: 6, border: '1px solid var(--accent)',
                  fontSize: 13, cursor: 'pointer', background: 'transparent',
                  color: 'var(--accent)', fontFamily: 'var(--mono)',
                }}
              >
                {c.name} ({c.currency})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Country selector (always visible for manual override) */}
      <div className="app-card">
        <p className="section-label" style={{ marginBottom: '0.5rem' }}>
          Jurisdiction
          {prefs.country && (
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
              saved · change anytime
            </span>
          )}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {COUNTRIES.map(c => (
            <button
              key={c.code}
              onClick={() => pickCountry(c.code)}
              style={{
                padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid',
                fontSize: 13, cursor: 'pointer',
                borderColor: country === c.code ? 'var(--accent)' : 'var(--rule)',
                background: country === c.code ? 'var(--accent)' : 'transparent',
                color: country === c.code ? '#fff' : 'var(--ink-2)',
                fontFamily: 'var(--mono)',
              }}
            >
              {c.name} ({c.currency})
            </button>
          ))}
        </div>
      </div>

      {/* History section */}
      {publicKey && (
        <div className="app-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 className="card-title" style={{ margin: 0 }}>
              {thisYear} — {cfg.name} trades
            </h3>
            {countryRecords.length > 0 && (
              <button
                onClick={downloadReport}
                style={{
                  padding: '0.35rem 0.85rem', borderRadius: 6, border: '1px solid var(--accent)',
                  background: 'transparent', color: 'var(--accent)', fontSize: 12,
                  cursor: 'pointer', fontFamily: 'var(--mono)', whiteSpace: 'nowrap',
                }}
              >
                {downloading ? 'Generating…' : `↓ Download ${cfg.fiscalYear} PDF`}
              </button>
            )}
          </div>

          {loading && <p className="form-hint">Loading history…</p>}
          {!loading && countryRecords.length === 0 && (
            <p className="form-hint">No completed {cfg.currency} trades found this year.</p>
          )}
          {!loading && countryRecords.length > 0 && (
            <>
              <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
                {[
                  ['Trades settled', `${countryRecords.length}`],
                  ['Total volume', formatFiat(totalFiatVolume, country)],
                  ['Per-trade tax withheld', formatFiat(perTradeTaxTotal, country)],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{label}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)' }}>{value}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--rule)', paddingTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
                {countryRecords.slice(0, 10).map(r => (
                  <div key={r.tradeId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: 12, gap: '0.5rem' }}>
                    <div style={{ color: 'var(--ink-2)', fontFamily: 'var(--mono)', minWidth: 0 }}>
                      <div>
                        {r.tradeId.slice(0, 8)}…
                        <span style={{ marginLeft: 8, color: 'var(--ink-mute)' }}>
                          {new Date(r.releasedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div style={{ marginTop: 2 }}>
                        {r.utrNumber && (
                          <span style={{ color: 'var(--ink-mute)', fontSize: 11 }}>
                            UTR: {r.utrNumber}
                          </span>
                        )}
                        {r.txSignature && (
                          <a
                            href={txExplorerUrl(r.txSignature)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ marginLeft: r.utrNumber ? 8 : 0, fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}
                          >
                            ↗ Solana Explorer
                          </a>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ color: 'var(--ink)' }}>{formatFiat(r.fiatAmountMinor, country)}</div>
                      {r.taxes.filter(t => t.applicable).map(t => (
                        <div key={t.section} style={{ color: 'var(--accent)', fontSize: 11 }}>
                          {t.section}: {t.amountFormatted}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {countryRecords.length > 10 && (
                  <p className="form-hint">{countryRecords.length - 10} more trade(s) included in the downloaded report.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {!publicKey && (
        <div className="app-card">
          <p className="form-hint">Connect your wallet to see your trade history and download your tax report.</p>
        </div>
      )}

      {/* Tax rules summary */}
      <div className="app-card">
        <p className="section-label" style={{ marginBottom: '0.5rem' }}>{cfg.name} — applicable rules</p>
        {calculateTaxLines(1_000_00, country).map(line => (
          <div key={line.section} style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline', marginBottom: '0.4rem' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', whiteSpace: 'nowrap', minWidth: 110 }}>
              {(line.rate * 100).toFixed(2).replace(/\.?0+$/, '')}% · {line.section}
            </span>
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{line.notes}</span>
          </div>
        ))}
      </div>

      {/* India capital gains calculator */}
      {country === 'IN' && indiaCalc && (
        <div className="app-card">
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>Capital Gains Calculator (Sec 115BBH)</h3>
          <div className="form-grid" style={{ marginBottom: '1rem' }}>
            <div className="form-field">
              <label className="form-label">SOL quantity sold</label>
              <input className="form-input" type="number" min="0" step="0.01" value={solAmount} onChange={e => setSolAmount(e.target.value)} placeholder="1" />
            </div>
            <div className="form-field">
              <label className="form-label">Buy price (₹ per SOL)</label>
              <input className="form-input" type="number" min="0" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} placeholder="e.g. 12000" />
            </div>
            <div className="form-field">
              <label className="form-label">Sell price (₹ per SOL)</label>
              <input className="form-input" type="number" min="0" value={sellPrice} onChange={e => setSellPrice(e.target.value)} placeholder="e.g. 15000" />
            </div>
            <div className="form-field">
              <label className="form-label">Other annual income (₹)</label>
              <input className="form-input" type="number" min="0" value={annualIncome} onChange={e => setAnnualIncome(e.target.value)} placeholder="500000" />
              <p className="form-hint">Determines surcharge bracket</p>
            </div>
          </div>
          {hasInputs && (
            <div style={{ borderTop: '1px solid var(--rule)', paddingTop: '1rem', display: 'grid', gap: '0.5rem' }}>
              {[
                ['Cost of acquisition', `₹${fmt(indiaCalc.cost)}`, ''],
                ['Sale proceeds', `₹${fmt(indiaCalc.proceeds)}`, ''],
                [indiaCalc.isGain ? 'Capital gain' : 'Capital loss', `₹${fmt(Math.abs(indiaCalc.gain))}`, indiaCalc.isGain ? 'accent' : 'danger'],
                ['Tax @ 30% (Sec 115BBH)', `₹${fmt(indiaCalc.base)}`, 'muted'],
                [`Surcharge @ ${(indiaCalc.sRate * 100).toFixed(0)}%`, `₹${fmt(indiaCalc.surcharge)}`, 'muted'],
                ['Health & Education Cess @ 4%', `₹${fmt(indiaCalc.cess)}`, 'muted'],
                ['Total tax liability', `₹${fmt(indiaCalc.total)}`, 'strong'],
                ['Effective rate on gain', `${indiaCalc.effective.toFixed(2)}%`, 'strong'],
                ['TDS deducted by buyer (1%)', `₹${fmt(indiaCalc.tds)}`, 'muted'],
              ].map(([label, value, cls]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{label}</span>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 13,
                    fontWeight: cls === 'strong' ? 700 : 400,
                    color: cls === 'accent' ? 'var(--accent)' : cls === 'danger' ? 'var(--danger,#c0392b)' : cls === 'muted' ? 'var(--ink-mute)' : 'var(--ink)',
                  }}>{value}</span>
                </div>
              ))}
              {!indiaCalc.isGain && (
                <p className="form-hint" style={{ marginTop: '0.5rem', color: 'var(--danger,#c0392b)' }}>
                  ⚠ Loss of ₹{fmt(Math.abs(indiaCalc.gain))} cannot be offset against other income.
                </p>
              )}
            </div>
          )}
          {!hasInputs && <p className="form-hint">Enter buy and sell prices to see breakdown.</p>}
        </div>
      )}

      {/* Generic capital gains for non-India */}
      {country !== 'IN' && genericCalc && (
        <div className="app-card">
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>Capital Gains Estimate ({cfg.name})</h3>
          <div className="form-grid" style={{ marginBottom: '1rem' }}>
            <div className="form-field">
              <label className="form-label">SOL quantity sold</label>
              <input className="form-input" type="number" min="0" step="0.01" value={solAmount} onChange={e => setSolAmount(e.target.value)} placeholder="1" />
            </div>
            <div className="form-field">
              <label className="form-label">Buy price ({cfg.currency})</label>
              <input className="form-input" type="number" min="0" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Sell price ({cfg.currency})</label>
              <input className="form-input" type="number" min="0" value={sellPrice} onChange={e => setSellPrice(e.target.value)} />
            </div>
          </div>
          {hasInputs && (
            <div style={{ borderTop: '1px solid var(--rule)', paddingTop: '1rem', display: 'grid', gap: '0.5rem' }}>
              {[
                ['Cost of acquisition', fmtCurrency(genericCalc.cost, country)],
                ['Sale proceeds', fmtCurrency(genericCalc.proceeds, country)],
                [genericCalc.gain >= 0 ? 'Capital gain' : 'Capital loss', fmtCurrency(Math.abs(genericCalc.gain), country)],
                ...genericCalc.taxLines.map(t => [
                  `Est. ${t.label} (${(t.rate * 100).toFixed(2).replace(/\.?0+$/, '')}%)`,
                  fmtCurrency(genericCalc.gain > 0 ? genericCalc.gain * t.rate : 0, country),
                ]),
              ].map(([label, value]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{label}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)' }}>{value}</span>
                </div>
              ))}
            </div>
          )}
          {!hasInputs && <p className="form-hint">Enter buy and sell prices to see estimate.</p>}
        </div>
      )}

      {/* India TDS quick calc */}
      {country === 'IN' && (
        <div className="app-card">
          <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>TDS Quick Calculator (Sec 194S)</h3>
          <p className="form-hint" style={{ marginBottom: '1rem' }}>1% deducted by buyer on every trade.</p>
          <div className="form-grid" style={{ marginBottom: '1rem' }}>
            <div className="form-field">
              <label className="form-label">INR consideration (₹)</label>
              <input className="form-input" type="number" min="0" step="100" value={tdsAmount} onChange={e => setTdsAmount(e.target.value)} placeholder="e.g. 15000" />
            </div>
          </div>
          {tdsAmount && (
            <div style={{ borderTop: '1px solid var(--rule)', paddingTop: '1rem', display: 'grid', gap: '0.5rem' }}>
              {[
                ['Gross consideration', `₹${fmt(parseFloat(tdsAmount) || 0)}`],
                ['TDS @ 1%', `₹${fmt(tdsSolo.tds)}`],
                ['Net received by seller', `₹${fmt(tdsSolo.net)}`],
              ].map(([label, value]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{label}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)' }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="form-hint" style={{ textAlign: 'center' }}>
        For informational purposes only. Consult a qualified tax advisor in your jurisdiction.
      </p>
    </div>
  );
}
