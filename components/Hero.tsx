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
            A neutral oracle layer that witnesses fiat settlement off-chain and
            releases stablecoin escrow on-chain — in one verifiable call. Built
            for the seven billion people who live between rails.
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
