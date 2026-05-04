'use client';

import { ExternalLink } from 'lucide-react';
import { txExplorerUrl } from '@/lib/solana/utils';
import type { OracleAttestationData } from '@/types';

interface ProofCardProps {
  attestationHash: string;
  attestation: OracleAttestationData;
  oraclePubkey: string;
  txSignature?: string;
}

export function ProofCard({ attestationHash, attestation, oraclePubkey, txSignature }: ProofCardProps) {
  const rows: [string, string][] = [
    ['Trade ID',       attestation.tradeId],
    ['INR Amount',     `₹${(attestation.inrAmount / 100).toLocaleString('en-IN')} (${attestation.inrAmount} paisa)`],
    ['Payer hash',     attestation.payerHash],
    ['Payee hash',     attestation.payeeHash],
    ['Timestamp',      new Date(attestation.timestamp * 1000).toUTCString()],
    ['Expires at',     new Date(attestation.expiresAt * 1000).toUTCString()],
    ['Evidence hash',  attestation.evidenceHash],
    ['Risk score',     String(attestation.riskScore)],
    ['Oracle pubkey',  oraclePubkey],
    ['Signature',      attestation.signature.slice(0, 32) + '…' + attestation.signature.slice(-16)],
    ['Attestation hash', attestationHash],
  ];

  return (
    <div className="proof-card">
      <div className="proof-card-header">
        <h2 className="proof-card-title">Oracle Attestation Proof</h2>
        <p className="proof-card-sub">Ed25519 signed · SHA-256 message digest</p>
      </div>

      <dl className="proof-dl">
        {rows.map(([label, value]) => (
          <div key={label} className="proof-dl-row">
            <dt className="proof-dt">{label}</dt>
            <dd className="proof-dd">{value}</dd>
          </div>
        ))}
      </dl>

      {txSignature && (
        <div className="proof-tx">
          <a
            href={txExplorerUrl(txSignature)}
            target="_blank"
            rel="noopener noreferrer"
            className="proof-tx-link"
          >
            View release tx on Solana Explorer <ExternalLink size={12} />
          </a>
        </div>
      )}
    </div>
  );
}
