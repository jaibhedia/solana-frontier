import { COUNTRY_CONFIG } from '@/lib/tax';
import { txExplorerUrl } from '@/lib/solana/utils';
import type { TxnRecord } from '@/types';

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmtMinor(minor: number, decimals: number): string {
  return (minor / Math.pow(10, decimals)).toFixed(decimals);
}

interface ReportSchema {
  filingRef: string;
  headers: string[];
  row: (r: TxnRecord, idx: number) => (string | number)[];
  totalsRow: (rows: TxnRecord[]) => (string | number)[];
}

const SCHEMAS: Record<string, ReportSchema> = {
  IN: {
    filingRef: 'ITR Schedule VDA — Sec 115BBH / 194S (AY 2025-26)',
    headers: ['Sr No', 'VDA', 'Date Acquired', 'Date Transferred',
      'Cost (₹)', 'Consideration (₹)', 'Net P&L (₹)', 'TDS (₹)', 'UTR', 'On-Chain Tx'],
    row: (r, i) => {
      const tds = r.taxes.find(t => t.section === '194S');
      return [i + 1, 'SOL', fmtDate(r.createdAt), fmtDate(r.releasedAt),
        '—', fmtMinor(r.fiatAmountMinor, 2),
        '—', tds ? fmtMinor(tds.amountMinor, 2) : '0.00',
        r.utrNumber ?? '—', txExplorerUrl(r.txSignature)];
    },
    totalsRow: (rows) => {
      const vol = rows.reduce((s, r) => s + r.fiatAmountMinor, 0);
      const tds = rows.reduce((s, r) => s + (r.taxes.find(t => t.section === '194S')?.amountMinor ?? 0), 0);
      return ['TOTAL', '', '', '', '', fmtMinor(vol, 2), '', fmtMinor(tds, 2), '', ''];
    },
  },
  BR: {
    filingRef: 'GCAP / DIRPF — Renda Variável Criptomoedas',
    headers: ['Nº', 'Ativo', 'Aquisição', 'Alienação', 'Custo (R$)', 'Venda (R$)', 'Ganho (R$)', 'IR Est. (R$)', 'Ref.', 'On-Chain Tx'],
    row: (r, i) => [i + 1, 'SOL', fmtDate(r.createdAt), fmtDate(r.releasedAt),
      '—', fmtMinor(r.fiatAmountMinor, 2), '—', '—', r.utrNumber ?? '—', txExplorerUrl(r.txSignature)],
    totalsRow: (rows) => {
      const vol = rows.reduce((s, r) => s + r.fiatAmountMinor, 0);
      return ['TOTAL', '', '', '', '', fmtMinor(vol, 2), '', '', '', ''];
    },
  },
  NG: {
    filingRef: 'FIRS CGT Return — Crypto Assets (CGT Act 2021)',
    headers: ['No', 'Asset', 'Acquired', 'Disposed', 'Cost (₦)', 'Proceeds (₦)', 'Gain (₦)', 'CGT 10% (₦)', 'Ref.', 'On-Chain Tx'],
    row: (r, i) => [i + 1, 'SOL', fmtDate(r.createdAt), fmtDate(r.releasedAt),
      '—', fmtMinor(r.fiatAmountMinor, 2), '—', '—', r.utrNumber ?? '—', txExplorerUrl(r.txSignature)],
    totalsRow: (rows) => {
      const vol = rows.reduce((s, r) => s + r.fiatAmountMinor, 0);
      return ['TOTAL', '', '', '', '', fmtMinor(vol, 2), '', '', '', ''];
    },
  },
  EU: {
    filingRef: 'Capital Asset Disposal — Crypto (national law applies)',
    headers: ['No', 'Asset', 'Acquired', 'Disposed', 'Cost (€)', 'Proceeds (€)', 'Gain (€)', 'Est. Tax 20% (€)', 'Ref.', 'On-Chain Tx'],
    row: (r, i) => [i + 1, 'SOL', fmtDate(r.createdAt), fmtDate(r.releasedAt),
      '—', fmtMinor(r.fiatAmountMinor, 2), '—', '—', r.utrNumber ?? '—', txExplorerUrl(r.txSignature)],
    totalsRow: (rows) => {
      const vol = rows.reduce((s, r) => s + r.fiatAmountMinor, 0);
      return ['TOTAL', '', '', '', '', fmtMinor(vol, 2), '', '', '', ''];
    },
  },
  MX: {
    filingRef: 'SAT ISR — Enajenación de Activos Digitales',
    headers: ['No', 'Activo', 'Adquisición', 'Enajenación', 'Costo (MXN)', 'Ingreso (MXN)', 'Ganancia (MXN)', 'ISR 10% (MXN)', 'Ref.', 'On-Chain Tx'],
    row: (r, i) => [i + 1, 'SOL', fmtDate(r.createdAt), fmtDate(r.releasedAt),
      '—', fmtMinor(r.fiatAmountMinor, 2), '—', '—', r.utrNumber ?? '—', txExplorerUrl(r.txSignature)],
    totalsRow: (rows) => {
      const vol = rows.reduce((s, r) => s + r.fiatAmountMinor, 0);
      return ['TOTAL', '', '', '', '', fmtMinor(vol, 2), '', '', '', ''];
    },
  },
  ID: {
    filingRef: 'SPT PPh & PPN Kripto — PMK-68/2022',
    headers: ['No', 'Aset', 'Akuisisi', 'Pengalihan', 'Hasil (Rp)', 'PPh 0.1%', 'PPN 0.11%', 'Total Pajak', 'Ref.', 'On-Chain Tx'],
    row: (r, i) => {
      const p = r.fiatAmountMinor;
      return [i + 1, 'SOL', fmtDate(r.createdAt), fmtDate(r.releasedAt),
        fmtMinor(p, 0), fmtMinor(Math.floor(p * 0.001), 0), fmtMinor(Math.floor(p * 0.0011), 0),
        fmtMinor(Math.floor(p * 0.001) + Math.floor(p * 0.0011), 0), r.utrNumber ?? '—', txExplorerUrl(r.txSignature)];
    },
    totalsRow: (rows) => {
      const vol = rows.reduce((s, r) => s + r.fiatAmountMinor, 0);
      return ['TOTAL', '', '', '', fmtMinor(vol, 0), fmtMinor(Math.floor(vol * 0.001), 0),
        fmtMinor(Math.floor(vol * 0.0011), 0), fmtMinor(Math.floor(vol * 0.0021), 0), '', ''];
    },
  },
  PH: {
    filingRef: 'BIR Form 1706 — CGT on Digital Assets',
    headers: ['No', 'Asset', 'Acquired', 'Transferred', 'Cost (₱)', 'Proceeds (₱)', 'Gain (₱)', 'CGT 15% (₱)', 'Ref.', 'On-Chain Tx'],
    row: (r, i) => [i + 1, 'SOL', fmtDate(r.createdAt), fmtDate(r.releasedAt),
      '—', fmtMinor(r.fiatAmountMinor, 2), '—', '—', r.utrNumber ?? '—', txExplorerUrl(r.txSignature)],
    totalsRow: (rows) => {
      const vol = rows.reduce((s, r) => s + r.fiatAmountMinor, 0);
      return ['TOTAL', '', '', '', '', fmtMinor(vol, 2), '', '', '', ''];
    },
  },
  KE: {
    filingRef: 'KRA iTax — CGT on Digital Assets (Finance Act 2023)',
    headers: ['No', 'Asset', 'Acquired', 'Transferred', 'Cost (KSh)', 'Transfer Value (KSh)', 'Gain (KSh)', 'CGT 15% (KSh)', 'Ref.', 'On-Chain Tx'],
    row: (r, i) => [i + 1, 'SOL', fmtDate(r.createdAt), fmtDate(r.releasedAt),
      '—', fmtMinor(r.fiatAmountMinor, 2), '—', '—', r.utrNumber ?? '—', txExplorerUrl(r.txSignature)],
    totalsRow: (rows) => {
      const vol = rows.reduce((s, r) => s + r.fiatAmountMinor, 0);
      return ['TOTAL', '', '', '', '', fmtMinor(vol, 2), '', '', '', ''];
    },
  },
};

// Colours matching the app's terracotta theme
const ACCENT   = [184, 71, 44]  as [number, number, number]; // #B8472C
const INK_DARK = [26,  20, 16]  as [number, number, number]; // #1A1410
const INK_MID  = [90,  75, 65]  as [number, number, number];
const CREAM    = [250, 247, 243] as [number, number, number];
const RULE     = [220, 213, 205] as [number, number, number];

export async function generateTaxReportPdf(
  records: TxnRecord[],
  country: string,
  walletAddress: string,
): Promise<Uint8Array> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const schema = SCHEMAS[country] ?? SCHEMAS['IN'];
  const cfg = COUNTRY_CONFIG[country];
  const now = new Date();
  const year = now.getFullYear();

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();

  // ── Cover header ────────────────────────────────────────────────────────────
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, pw, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('Solana Frontier P2P — Crypto Tax Report', 12, 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${cfg?.name ?? country} · ${schema.filingRef}`, 12, 15.5);

  // ── Meta block ──────────────────────────────────────────────────────────────
  doc.setTextColor(...INK_MID);
  doc.setFontSize(8);
  const metaY = 28;
  const metaLines = [
    [`Wallet`,    walletAddress],
    [`Generated`, now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'],
    [`Trades`,    `${records.length} settled transaction(s) in ${year}`],
    [`Currency`,  cfg?.currency ?? country],
  ];
  metaLines.forEach(([label, value], idx) => {
    const x = 12 + idx * 72;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...INK_DARK);
    doc.text(label, x, metaY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...INK_MID);
    // Truncate wallet for display
    const display = label === 'Wallet' ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
    doc.text(display, x, metaY + 5);
  });

  // ── Rule ────────────────────────────────────────────────────────────────────
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(12, metaY + 10, pw - 12, metaY + 10);

  // ── Table ───────────────────────────────────────────────────────────────────
  const tableStartY = metaY + 14;

  const bodyRows = records.map((r, i) => schema.row(r, i));
  const totalRow = schema.totalsRow(records);

  autoTable(doc, {
    startY: tableStartY,
    head: [schema.headers],
    body: bodyRows,
    foot: records.length > 0 ? [totalRow] : [],
    margin: { left: 12, right: 12 },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      overflow: 'ellipsize',
      textColor: INK_DARK,
    },
    headStyles: {
      fillColor: INK_DARK,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    footStyles: {
      fillColor: CREAM,
      textColor: INK_DARK,
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: CREAM,
    },
    columnStyles: {
      // Last column (On-Chain Tx) gets more width and small text
      9: { cellWidth: 55, fontSize: 6, textColor: ACCENT },
    },
    didDrawPage: (data) => {
      // Page footer
      const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...INK_MID);
      const ph = doc.internal.pageSize.getHeight();
      doc.text(
        'For informational purposes only. Cost of acquisition fields marked — must be filled from your own purchase records. Verify with a qualified tax advisor.',
        12, ph - 8,
        { maxWidth: pw - 80 },
      );
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, pw - 24, ph - 8);
    },
  });

  if (records.length === 0) {
    const tableEndY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? tableStartY + 20;
    doc.setFontSize(9);
    doc.setTextColor(...INK_MID);
    doc.text('No settled transactions found for this jurisdiction and year.', 12, tableEndY + 10);
  }

  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);
}
