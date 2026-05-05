'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

function fmt(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function fmtINR(n: number) {
  return `₹${fmt(n)}`;
}

type SurchargeSlab = { limit: number; rate: number; label: string };
const SURCHARGE_SLABS: SurchargeSlab[] = [
  { limit: 5_000_000,   rate: 0,    label: 'Nil (income ≤ ₹50L)' },
  { limit: 10_000_000,  rate: 0.10, label: '10% (₹50L – ₹1Cr)' },
  { limit: 20_000_000,  rate: 0.15, label: '15% (₹1Cr – ₹2Cr)' },
  { limit: 50_000_000,  rate: 0.25, label: '25% (₹2Cr – ₹5Cr)' },
  { limit: Infinity,    rate: 0.37, label: '37% (above ₹5Cr)' },
];

function surchargeRate(annualIncome: number): number {
  return SURCHARGE_SLABS.find(s => annualIncome <= s.limit)?.rate ?? 0.37;
}

export default function TaxPage() {
  // Capital gains inputs
  const [solAmount, setSolAmount] = useState('1');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [annualIncome, setAnnualIncome] = useState('500000');

  // TDS standalone
  const [tdsAmount, setTdsAmount] = useState('');

  const calc = useMemo(() => {
    const qty  = parseFloat(solAmount)  || 0;
    const buy  = parseFloat(buyPrice)   || 0;
    const sell = parseFloat(sellPrice)  || 0;
    const income = parseFloat(annualIncome) || 0;

    const costOfAcquisition = qty * buy;
    const proceeds          = qty * sell;
    const gain              = proceeds - costOfAcquisition;
    const isGain            = gain > 0;

    // Section 115BBH: 30% flat on gains, losses not deductible
    const taxableGain  = isGain ? gain : 0;
    const baseTax      = taxableGain * 0.30;
    const sRate        = surchargeRate(income);
    const surcharge    = baseTax * sRate;
    const cess         = (baseTax + surcharge) * 0.04;
    const totalTax     = baseTax + surcharge + cess;
    const effectiveRate = taxableGain > 0 ? (totalTax / taxableGain) * 100 : 0;

    // Section 194S: 1% TDS on proceeds (buyer deducts)
    const tds          = proceeds * 0.01;
    const netAfterTds  = proceeds - tds;

    return { qty, costOfAcquisition, proceeds, gain, isGain, taxableGain, baseTax, surcharge, cess, totalTax, effectiveRate, tds, netAfterTds, sRate };
  }, [solAmount, buyPrice, sellPrice, annualIncome]);

  const tdsSolo = useMemo(() => {
    const val = parseFloat(tdsAmount) || 0;
    return { tds: val * 0.01, net: val * 0.99 };
  }, [tdsAmount]);

  const hasInputs = !!buyPrice && !!sellPrice;

  return (
    <div className="page-stack">
      <div>
        <Link href="/dashboard" className="app-back-link">← Dashboard</Link>
        <h1 className="page-title" style={{ marginTop: '0.5rem' }}>Indian Crypto Tax Calculator</h1>
        <p className="page-sub">Section 115BBH · Section 194S · AY 2025–26</p>
      </div>

      {/* Rules summary */}
      <div className="app-card" style={{ display: 'grid', gap: '0.5rem' }}>
        <p className="section-label" style={{ marginBottom: '0.25rem' }}>Key rules (VDA — Virtual Digital Assets)</p>
        {[
          ['30% flat tax', 'on gains from VDA (Sec 115BBH) — no slab benefit'],
          ['No loss offset', 'VDA losses cannot be set off against any other income'],
          ['1% TDS', 'buyer deducts at source on each trade (Sec 194S)'],
          ['4% cess', 'Health & Education Cess on (tax + surcharge)'],
          ['Surcharge', 'applies if total income exceeds ₹50L'],
        ].map(([rule, desc]) => (
          <div key={rule} style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', whiteSpace: 'nowrap', minWidth: 110 }}>{rule}</span>
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{desc}</span>
          </div>
        ))}
      </div>

      {/* Capital gains calculator */}
      <div className="app-card">
        <h3 className="card-title" style={{ marginBottom: '1rem' }}>Capital Gains Calculator</h3>

        <div className="form-grid" style={{ marginBottom: '1rem' }}>
          <div className="form-field">
            <label className="form-label">SOL quantity sold</label>
            <input className="form-input" type="number" min="0" step="0.01" value={solAmount} onChange={e => setSolAmount(e.target.value)} placeholder="1" />
          </div>
          <div className="form-field">
            <label className="form-label">Buy price (₹ per SOL)</label>
            <input className="form-input" type="number" min="0" step="1" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} placeholder="e.g. 12000" />
          </div>
          <div className="form-field">
            <label className="form-label">Sell price (₹ per SOL)</label>
            <input className="form-input" type="number" min="0" step="1" value={sellPrice} onChange={e => setSellPrice(e.target.value)} placeholder="e.g. 15000" />
          </div>
          <div className="form-field">
            <label className="form-label">Your other annual income (₹)</label>
            <input className="form-input" type="number" min="0" step="10000" value={annualIncome} onChange={e => setAnnualIncome(e.target.value)} placeholder="500000" />
            <p className="form-hint">Used to determine surcharge bracket</p>
          </div>
        </div>

        {hasInputs && (
          <div style={{ borderTop: '1px solid var(--rule)', paddingTop: '1rem', display: 'grid', gap: '0.5rem' }}>
            {[
              ['Cost of acquisition', fmtINR(calc.costOfAcquisition), ''],
              ['Sale proceeds', fmtINR(calc.proceeds), ''],
              [calc.isGain ? 'Capital gain' : 'Capital loss', fmtINR(Math.abs(calc.gain)), calc.isGain ? 'accent' : 'danger'],
              ['Tax @ 30% (Sec 115BBH)', fmtINR(calc.baseTax), 'muted'],
              [`Surcharge @ ${(calc.sRate * 100).toFixed(0)}%`, fmtINR(calc.surcharge), 'muted'],
              ['Health & Education Cess @ 4%', fmtINR(calc.cess), 'muted'],
              ['Total tax liability', fmtINR(calc.totalTax), 'strong'],
              ['Effective rate on gain', `${calc.effectiveRate.toFixed(2)}%`, 'strong'],
              ['TDS deducted by buyer (1%)', fmtINR(calc.tds), 'muted'],
              ['Net you receive after TDS', fmtINR(calc.netAfterTds), ''],
            ].map(([label, value, cls]) => (
              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
                <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{label}</span>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 13,
                  fontWeight: cls === 'strong' ? 700 : 400,
                  color: cls === 'accent' ? 'var(--accent)' : cls === 'danger' ? 'var(--danger, #c0392b)' : cls === 'muted' ? 'var(--ink-mute)' : 'var(--ink)',
                }}>{value}</span>
              </div>
            ))}

            {!calc.isGain && (
              <p className="form-hint" style={{ marginTop: '0.5rem', color: 'var(--danger, #c0392b)' }}>
                ⚠ Loss of {fmtINR(Math.abs(calc.gain))} cannot be set off against salary, business, or other income.
              </p>
            )}
          </div>
        )}

        {!hasInputs && (
          <p className="form-hint">Enter buy and sell prices to see the breakdown.</p>
        )}
      </div>

      {/* TDS quick calculator */}
      <div className="app-card">
        <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>TDS Quick Calculator (Sec 194S)</h3>
        <p className="form-hint" style={{ marginBottom: '1rem' }}>
          1% deducted by the buyer on every trade. Enter the INR consideration to see how much TDS applies.
        </p>
        <div className="form-grid" style={{ marginBottom: '1rem' }}>
          <div className="form-field">
            <label className="form-label">INR consideration (₹)</label>
            <input className="form-input" type="number" min="0" step="100" value={tdsAmount} onChange={e => setTdsAmount(e.target.value)} placeholder="e.g. 15000" />
          </div>
        </div>
        {tdsAmount && (
          <div style={{ borderTop: '1px solid var(--rule)', paddingTop: '1rem', display: 'grid', gap: '0.5rem' }}>
            {[
              ['Gross consideration', fmtINR(parseFloat(tdsAmount) || 0)],
              ['TDS @ 1%', fmtINR(tdsSolo.tds)],
              ['Net received by seller', fmtINR(tdsSolo.net)],
            ].map(([label, value]) => (
              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)' }}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="form-hint" style={{ textAlign: 'center' }}>
        For informational purposes only. Consult a CA for your specific situation.
      </p>
    </div>
  );
}
