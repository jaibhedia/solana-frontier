'use client';

export default function HeroSeal() {
  return (
    <div className="seal-card" aria-label="attestation seal">
      <svg viewBox="0 0 500 500">
        <defs>
          <path id="circle" d="M 250,250 m -215,0 a 215,215 0 1,1 430,0 a 215,215 0 1,1 -430,0" />
          <path id="circle2" d="M 250,250 m -175,0 a 175,175 0 1,1 350,0 a 175,175 0 1,1 -350,0" />
        </defs>
        {/* outer ring */}
        <circle cx="250" cy="250" r="230" fill="none" stroke="rgba(26,20,16,0.35)" strokeWidth="0.6" />
        <circle cx="250" cy="250" r="225" fill="none" stroke="rgba(26,20,16,0.3)" strokeWidth="0.4" strokeDasharray="3 4" />
        {/* rotating text */}
        <g style={{ transformOrigin: '250px 250px', animation: 'spin 48s linear infinite' }}>
          <text fontFamily="var(--mono)" fontSize="13" letterSpacing="4" fill="var(--ink)">
            <textPath href="#circle" startOffset="0%">
              · SETTLEMENT WITNESSED · ORACLE ATTESTATION · ESCROW RELEASED · FIAT CONFIRMED · PROOF INCLUDED · SETTLEMENT WITNESSED ·
            </textPath>
          </text>
        </g>
        {/* inner ring */}
        <circle cx="250" cy="250" r="180" fill="none" stroke="rgba(26,20,16,0.25)" strokeWidth="0.5" />
        {/* tick marks */}
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2;
          const r1 = 190, r2 = 200;
          const r = (n: number) => Math.round(n * 1e4) / 1e4;
          const x1 = r(250 + Math.cos(a) * r1), y1 = r(250 + Math.sin(a) * r1);
          const x2 = r(250 + Math.cos(a) * r2), y2 = r(250 + Math.sin(a) * r2);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(26,20,16,0.35)" strokeWidth={i % 5 === 0 ? 1 : 0.4} />;
        })}
        {/* crosshair */}
        <line x1="250" y1="70" x2="250" y2="95" stroke="rgba(26,20,16,0.3)" strokeWidth="0.5" />
        <line x1="250" y1="405" x2="250" y2="430" stroke="rgba(26,20,16,0.3)" strokeWidth="0.5" />
        <line x1="70" y1="250" x2="95" y2="250" stroke="rgba(26,20,16,0.3)" strokeWidth="0.5" />
        <line x1="405" y1="250" x2="430" y2="250" stroke="rgba(26,20,16,0.3)" strokeWidth="0.5" />
        {/* center field */}
        <circle cx="250" cy="250" r="130" fill="rgba(251,246,234,0.35)" stroke="rgba(26,20,16,0.2)" strokeWidth="0.6" />
        {/* stamp in the middle */}
        <g transform="translate(250 250) rotate(-8)">
          <rect x="-95" y="-55" width="190" height="110" rx="8" fill="none" stroke="var(--accent)" strokeWidth="2" opacity="0.85" />
          <rect x="-90" y="-50" width="180" height="100" rx="6" fill="none" stroke="var(--accent)" strokeWidth="0.7" opacity="0.7" />
        </g>
        {/* corner marks */}
        <text x="40" y="38" fontFamily="var(--mono)" fontSize="10" letterSpacing="2" fill="var(--ink-mute)">LOT · 00412</text>
        <text x="360" y="38" fontFamily="var(--mono)" fontSize="10" letterSpacing="2" fill="var(--ink-mute)">SEAL · 07</text>
        <text x="40" y="478" fontFamily="var(--mono)" fontSize="10" letterSpacing="2" fill="var(--ink-mute)">2026-04-19</text>
        <text x="340" y="478" fontFamily="var(--mono)" fontSize="10" letterSpacing="2" fill="var(--ink-mute)">v0.9.2</text>
      </svg>
      <div className="seal-meta">
        <div>attested settlement</div>
        <span className="big">₹ 1,24,800</span>
        <div className="tiny">≈ 1,500 usdc · block 22,409,118</div>
      </div>
    </div>
  );
}
