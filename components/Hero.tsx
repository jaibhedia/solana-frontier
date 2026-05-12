import HeroSeal from './HeroSeal';

export default function Hero() {
  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <div>
          <div className="eyebrow">
            <span className="dot"></span>
            <span>Attestation layer · v0.9.2 devnet</span>
          </div>
          <h1 className="display">
            <span>Proof</span>{' '}
            <span className="italic">the money</span><br />
            <span className="outline tight">actually</span>{' '}
            <span>moved.</span>
          </h1>
          <p className="lede">
            A decentralized verification layer that transforms any fiat payment
            into a cryptographically signed on-chain primitive. Plug UPI, Pix,
            or ACH directly into your protocol logic — no custodian, no
            middleman, no trust required.
          </p>
          <div className="cta-row">
            <a href="#waitlist" className="btn">Join the waitlist</a>
            <a href="#how" className="btn ghost">How it works</a>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              No custody. No screenshots.
            </span>
          </div>
        </div>
        <HeroSeal />
      </div>
    </section>
  );
}
