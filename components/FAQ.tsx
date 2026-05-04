'use client';

import { useState } from 'react';
import type { FaqItem } from '@/types';

const items: FaqItem[] = [
  {
    q: 'Who actually runs the oracle?',
    a: 'A permissionless validator set. Anyone can stake collateral and run a node; attestations require a supermajority signature, and malicious signers get slashed. The protocol itself is neutral — we don\'t run validators.',
  },
  {
    q: 'Why not just use payment screenshots?',
    a: 'Screenshots are trivially faked and require a human dispute loop. Our oracle reads directly from bank APIs, UPI webhooks, and payment-network feeds where available, then produces a signed cryptographic proof. No humans in the release path.',
  },
  {
    q: 'Which fiat rails are supported today?',
    a: 'India (UPI, IMPS, NEFT), Brazil (Pix), Eurozone (SEPA Instant), Nigeria (NIBSS), Mexico (SPEI), Philippines (InstaPay), Kenya (M-Pesa). Seven more are in private testing.',
  },
  {
    q: 'Is there custody risk?',
    a: 'None. Stablecoins live in audited escrow contracts; the oracle can only release to the pre-committed recipient address specified at trade creation. There is no admin key and no upgrade path that routes funds.',
  },
  {
    q: 'What does it cost?',
    a: '10 basis points on the stablecoin leg. No fees on the fiat side. Validator rewards come out of the protocol fee; there is no separate gas surcharge on the attestation call.',
  },
];

export default function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <section className="section" id="faq">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="section-num">§ 03 — Questions</div>
            <h2 className="section-title">The short answers.</h2>
          </div>
          <p className="section-kicker">
            Longer ones live in the whitepaper. If yours isn&apos;t here, drop us a
            line — we&apos;ll publish the good ones.
          </p>
        </div>
        <div className="faq-list">
          {items.map((it, i) => (
            <div key={i} className={'faq-item' + (open === i ? ' open' : '')}>
              <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)}>
                <span>{it.q}</span>
                <span className="plus">+</span>
              </button>
              <div className="faq-a"><p>{it.a}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
