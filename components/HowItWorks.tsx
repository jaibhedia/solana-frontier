import type { HowStep } from '@/types';

const steps: HowStep[] = [
  {
    n: 'i',
    title: 'Lock the stablecoin',
    body: 'Seller locks USDC, USDT or EURC into a trustless escrow contract. No counterparty risk, no middleman holding the bag.',
    art: 'ESCROW.LOCK() → 0x4a…f2',
  },
  {
    n: 'ii',
    title: 'Witness the fiat',
    body: 'Buyer sends the fiat through their normal rails — UPI, Pix, SEPA, ACH. A decentralized oracle network watches and signs the proof.',
    art: 'PROOF.SIGNED × 7/9 validators',
  },
  {
    n: 'iii',
    title: 'Release, verified',
    body: 'One on-chain call submits the attestation. Escrow unlocks automatically to the buyer. End-to-end in under ninety seconds.',
    art: 'ESCROW.RELEASE() ✓ settled',
  },
];

export default function HowItWorks() {
  return (
    <section className="section" id="how">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="section-num">§ 01 — Mechanism</div>
            <h2 className="section-title">Three moves,<br /><em>one proof.</em></h2>
          </div>
          <p className="section-kicker">
            Every cross-rail trade gets compressed into a single verifiable
            attestation. No chat logs, no payment screenshots, no trust me bro.
          </p>
        </div>
        <div className="steps">
          {steps.map((s) => (
            <div className="step" key={s.n}>
              <div className="step-num">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <div className="step-art">{s.art}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
