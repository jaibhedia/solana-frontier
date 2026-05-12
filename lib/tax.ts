import type { TaxLine } from '@/types';

export interface CountryConfig {
  name: string;
  currency: string;
  symbol: string;
  minorUnit: number; // digits after decimal, e.g. 2 for cents, 0 for yen
  locale: string;
  fiscalYear: string;
}

export const COUNTRY_CONFIG: Record<string, CountryConfig> = {
  IN: { name: 'India',       currency: 'INR', symbol: '₹',  minorUnit: 2, locale: 'en-IN', fiscalYear: 'AY 2025–26' },
  BR: { name: 'Brazil',      currency: 'BRL', symbol: 'R$', minorUnit: 2, locale: 'pt-BR', fiscalYear: '2025' },
  NG: { name: 'Nigeria',     currency: 'NGN', symbol: '₦',  minorUnit: 2, locale: 'en-NG', fiscalYear: '2025' },
  EU: { name: 'EU / Europe', currency: 'EUR', symbol: '€',  minorUnit: 2, locale: 'de-DE', fiscalYear: '2025' },
  MX: { name: 'Mexico',      currency: 'MXN', symbol: '$',  minorUnit: 2, locale: 'es-MX', fiscalYear: '2025' },
  ID: { name: 'Indonesia',   currency: 'IDR', symbol: 'Rp', minorUnit: 0, locale: 'id-ID', fiscalYear: '2025' },
  PH: { name: 'Philippines', currency: 'PHP', symbol: '₱',  minorUnit: 2, locale: 'en-PH', fiscalYear: '2025' },
  KE: { name: 'Kenya',       currency: 'KES', symbol: 'KSh',minorUnit: 2, locale: 'en-KE', fiscalYear: '2025' },
};

interface TaxRuleDef {
  label: string;
  section: string;
  rate: number;
  perTrade: boolean; // true = applies on every trade, false = annual capital-gains guidance
  threshold?: number; // minimum fiatMinor for per-trade rules (omit = always applies)
  notes?: string;
}

const TAX_RULES: Record<string, TaxRuleDef[]> = {
  IN: [
    {
      label: 'TDS (Sec 194S)',
      section: '194S',
      rate: 0.01,
      perTrade: true,
      threshold: 1_000_00, // ₹10,000 in paisa
      notes: 'Buyer deducts 1% TDS at source on each trade ≥ ₹10,000',
    },
    {
      label: 'Capital Gains Tax (Sec 115BBH)',
      section: '115BBH',
      rate: 0.30,
      perTrade: false,
      notes: '30% flat tax on VDA gains — no slab benefit, losses non-deductible. Declare in ITR.',
    },
  ],
  BR: [
    {
      label: 'Capital Gains Tax (GCAP)',
      section: 'RFB Art. 21',
      rate: 0.15,
      perTrade: false,
      notes: 'Exempt if total crypto sales < R$35,000/month. 15% on gains otherwise (scales to 22.5% above R$5M). Declare via GCAP.',
    },
  ],
  NG: [
    {
      label: 'Capital Gains Tax (CGT)',
      section: 'CGT Act 2021',
      rate: 0.10,
      perTrade: false,
      notes: '10% on net crypto gains per FIRS guidance (2023). File with annual CGT return.',
    },
  ],
  EU: [
    {
      label: 'Capital Gains Tax (est.)',
      section: 'National law',
      rate: 0.20,
      perTrade: false,
      notes: 'Rate varies by EU member state (Germany ~26%, France 30%, Netherlands 31%). 20% used as reference. Check local rules.',
    },
  ],
  MX: [
    {
      label: 'ISR Capital Gains',
      section: 'LISR Art. 129',
      rate: 0.10,
      perTrade: false,
      notes: '10% preferential rate for individuals on capital gains from digital assets. Declare via SAT annual return.',
    },
  ],
  ID: [
    {
      label: 'PPh + PPN (PMK-68/2022)',
      section: 'PMK-68/2022',
      rate: 0.0021,
      perTrade: true,
      notes: '0.1% income tax (PPh) + 0.11% VAT (PPN) on each crypto transaction. Withheld by exchange.',
    },
  ],
  PH: [
    {
      label: 'Capital Gains Tax',
      section: 'NIRC Sec 24(D)',
      rate: 0.15,
      perTrade: false,
      notes: '15% on net gains from crypto treated as capital asset. Declare via BIR Form 1706.',
    },
  ],
  KE: [
    {
      label: 'Capital Gains Tax',
      section: 'ITA Sec 37A (Finance Act 2023)',
      rate: 0.15,
      perTrade: false,
      notes: '15% CGT on crypto gains (raised from 5% in Finance Act 2023). Declare via KRA iTax.',
    },
  ],
};

export function formatFiat(amountMinor: number, country: string): string {
  const cfg = COUNTRY_CONFIG[country];
  if (!cfg) return String(amountMinor);
  const divisor = Math.pow(10, cfg.minorUnit);
  const value = amountMinor / divisor;
  return cfg.symbol + value.toLocaleString(cfg.locale, { minimumFractionDigits: cfg.minorUnit, maximumFractionDigits: cfg.minorUnit });
}

export function calculateTaxLines(fiatMinor: number, country: string): TaxLine[] {
  const rules = TAX_RULES[country] ?? [];
  return rules.map((rule) => {
    const meetsThreshold = rule.threshold === undefined || fiatMinor >= rule.threshold;
    const applicable = rule.perTrade && meetsThreshold;
    const amountMinor = applicable ? Math.floor(fiatMinor * rule.rate) : 0;
    return {
      label: rule.label,
      section: rule.section,
      rate: rule.rate,
      amountMinor,
      amountFormatted: applicable ? formatFiat(amountMinor, country) : '—',
      applicable,
      notes: rule.notes,
    };
  });
}

export function currencyForCountry(country: string): string {
  return COUNTRY_CONFIG[country]?.currency ?? 'INR';
}
