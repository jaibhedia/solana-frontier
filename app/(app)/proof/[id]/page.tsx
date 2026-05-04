'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ProofCard } from '@/components/ProofCard';
import type { OracleAttestationData } from '@/types';

type ProofState = {
  attestationHash: string;
  attestation: OracleAttestationData;
  oraclePubkey: string;
  txSignature?: string;
} | null;

export default function ProofPage() {
  const params = useParams();
  const id = (params?.id as string) ?? '';

  const [proof, setProof] = useState<ProofState | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) { setProof(null); return; }
    fetch(`/api/attest?hash=${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Attestation not found');
        return res.json();
      })
      .then((data: { attestationHash: string; attestation: OracleAttestationData; oraclePubkey: string }) => {
        setProof({
          attestationHash: data.attestationHash,
          attestation: data.attestation,
          oraclePubkey: data.oraclePubkey,
        });
      })
      .catch((e: Error) => {
        setError(e.message);
        setProof(null);
      });
  }, [id]);

  if (proof === undefined) {
    return <div className="app-card app-loading">Loading proof…</div>;
  }

  if (proof === null) {
    return (
      <div className="app-card app-empty">
        <p>{error || 'Attestation not found.'}</p>
        <Link href="/trade" className="app-link">← P2P Market</Link>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div>
        <Link href="/explorer" className="app-back-link">← Explorer</Link>
        <h1 className="page-title" style={{ marginTop: '0.5rem' }}>Attestation Proof</h1>
      </div>
      <ProofCard
        attestationHash={proof.attestationHash}
        attestation={proof.attestation}
        oraclePubkey={proof.oraclePubkey}
        txSignature={proof.txSignature}
      />
    </div>
  );
}
