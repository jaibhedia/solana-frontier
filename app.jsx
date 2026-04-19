/* global React, ReactDOM */
const { useState, useEffect, useRef, useMemo } = React;

// ============================================================
// TWEAK DEFAULTS — persisted to disk via editmode protocol
// ============================================================
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "terracotta",
  "heroLayout": "A",
  "dark": false
}/*EDITMODE-END*/;

const ACCENT_MAP = {
  terracotta: { "--accent": "#B8472C", "--accent-2": "#6B7A3E", "--accent-3": "#C98A58" },
  olive:      { "--accent": "#6B7A3E", "--accent-2": "#B8472C", "--accent-3": "#C98A58" },
  clay:       { "--accent": "#C98A58", "--accent-2": "#6B7A3E", "--accent-3": "#B8472C" },
  rose:       { "--accent": "#C98585", "--accent-2": "#6B7A3E", "--accent-3": "#C98A58" },
  ink:        { "--accent": "#1A1410", "--accent-2": "#6B7A3E", "--accent-3": "#C98A58" },
};

// ============================================================
// FAKE DATA
// ============================================================
const ROUTES = [
  { from: "USDC",  to: "INR", fromRate: 83.2,  region: "IN" },
  { from: "USDC",  to: "BRL", fromRate: 5.07,  region: "BR" },
  { from: "USDT",  to: "NGN", fromRate: 1640,  region: "NG" },
  { from: "EURC",  to: "EUR", fromRate: 1.0,   region: "EU" },
  { from: "USDC",  to: "MXN", fromRate: 17.3,  region: "MX" },
  { from: "USDT",  to: "IDR", fromRate: 16200, region: "ID" },
  { from: "PYUSD", to: "PHP", fromRate: 56.1,  region: "PH" },
  { from: "USDC",  to: "KES", fromRate: 128.4, region: "KE" },
];

const STATUSES = [
  { label: "settled",   cls: "ok" },
  { label: "attesting", cls: "attest" },
  { label: "pending",   cls: "pending" },
];

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randId() {
  const hex = "0123456789abcdef";
  let s = "0x";
  for (let i = 0; i < 6; i++) s += hex[Math.floor(Math.random() * 16)];
  return s;
}
function fmt(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toFixed(0);
}

function genRow() {
  const r = ROUTES[randInt(0, ROUTES.length - 1)];
  const amt = randInt(50, 50000);
  const st = STATUSES[randInt(0, STATUSES.length - 1)];
  return {
    id: randId(),
    from: r.from, to: r.to,
    amt,
    fiat: (amt * r.fromRate).toFixed(0),
    status: st.label,
    cls: st.cls,
    t: Date.now(),
  };
}

// ============================================================
// APP
// ============================================================
function App() {
  const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);
  const [editMode, setEditMode] = useState(false);

  // editmode protocol
  useEffect(() => {
    const onMsg = (e) => {
      const d = e.data || {};
      if (d.type === "__activate_edit_mode") setEditMode(true);
      if (d.type === "__deactivate_edit_mode") setEditMode(false);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // apply accent + hero + dark
  useEffect(() => {
    const root = document.documentElement;
    const map = ACCENT_MAP[tweaks.accent] || ACCENT_MAP.terracotta;
    Object.entries(map).forEach(([k, v]) => root.style.setProperty(k, v));
    document.body.dataset.hero = tweaks.heroLayout;
    document.body.classList.toggle("dark", !!tweaks.dark);
  }, [tweaks]);

  const setTweak = (k, v) => {
    const next = { ...tweaks, [k]: v };
    setTweaks(next);
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [k]: v } }, "*");
  };

  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Ticker />
        <HowItWorks />
        <LiveExplorer />
        <Waitlist />
        <FAQ />
      </main>
      <Footer />
      {editMode && <TweaksPanel tweaks={tweaks} setTweak={setTweak} />}
    </>
  );
}

// ============================================================
// NAV
// ============================================================
function Nav() {
  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <a href="#" className="brand">
          <span className="seal" aria-hidden></span>
          <span>settle<em style={{ fontStyle: "italic", color: "var(--accent)" }}>.</em>infra</span>
        </a>
        <nav className="nav-links">
          <a href="#how">How it works</a>
          <a href="#explorer">Explorer</a>
          <a href="#waitlist">Waitlist</a>
          <a href="#docs">Docs</a>
        </nav>
        <button className="nav-cta">Open app →</button>
      </div>
    </header>
  );
}

// ============================================================
// HERO — original composition: a wax-seal / stamp metaphor
// ============================================================
function Hero() {
  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <div>
          <div className="eyebrow">
            <span className="dot"></span>
            <span>Attestation layer · v0.9.2 mainnet-beta</span>
          </div>
          <h1 className="display">
            <span>Proof</span>{" "}
            <span className="italic">the money</span><br/>
            <span className="outline tight">actually</span>{" "}
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
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              No custody. No screenshots.
            </span>
          </div>
        </div>
        <HeroSeal />
      </div>
    </section>
  );
}

function HeroSeal() {
  // animated ring of text + central stamp
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
        <g style={{ transformOrigin: "250px 250px", animation: "spin 48s linear infinite" }}>
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
          const x1 = 250 + Math.cos(a) * r1, y1 = 250 + Math.sin(a) * r1;
          const x2 = 250 + Math.cos(a) * r2, y2 = 250 + Math.sin(a) * r2;
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ============================================================
// TICKER
// ============================================================
function Ticker() {
  const items = [
    "Settlement, witnessed",
    "Oracle attestation v2",
    "No custody · no screenshots",
    "Escrow releases on proof",
    "Built for P2P fiat↔stablecoin",
    "Neutral · permissionless · verifiable",
    "Twelve currencies live",
    "One on-chain call",
  ];
  const loop = [...items, ...items];
  return (
    <div className="ticker">
      <div className="ticker-track">
        {loop.map((t, i) => (
          <span key={i}><span className="pip"></span>{t}</span>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// HOW IT WORKS
// ============================================================
function HowItWorks() {
  const steps = [
    {
      n: "i",
      title: "Lock the stablecoin",
      body: "Seller locks USDC, USDT or EURC into a trustless escrow contract. No counterparty risk, no middleman holding the bag.",
      art: "ESCROW.LOCK() → 0x4a…f2"
    },
    {
      n: "ii",
      title: "Witness the fiat",
      body: "Buyer sends the fiat through their normal rails — UPI, Pix, SEPA, ACH. A decentralized oracle network watches and signs the proof.",
      art: "PROOF.SIGNED × 7/9 validators"
    },
    {
      n: "iii",
      title: "Release, verified",
      body: "One on-chain call submits the attestation. Escrow unlocks automatically to the buyer. End-to-end in under ninety seconds.",
      art: "ESCROW.RELEASE() ✓ settled"
    },
  ];
  return (
    <section className="section" id="how">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="section-num">§ 01 — Mechanism</div>
            <h2 className="section-title">Three moves,<br/><em>one proof.</em></h2>
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

// ============================================================
// LIVE EXPLORER — animated feed + stat panels with sparklines
// ============================================================
function LiveExplorer() {
  const [rows, setRows] = useState(() => Array.from({ length: 7 }, genRow));
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setRows((prev) => [{ ...genRow(), isNew: true }, ...prev.slice(0, 6)]);
    }, 2200);
    return () => clearInterval(t);
  }, [paused]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter(r => r.to === filter);
  }, [rows, filter]);

  // stats
  const totalVol = useMemo(() => rows.reduce((a, b) => a + b.amt, 0) * 142, [rows]);

  return (
    <section className="section" id="explorer">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="section-num">§ 02 — Explorer</div>
            <h2 className="section-title">Every attestation,<br/><em>public by default.</em></h2>
          </div>
          <p className="section-kicker">
            A live feed of cryptographic settlements happening across the
            network. Click any row to inspect the proof on chain.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          {["all", "INR", "BRL", "EUR", "NGN", "PHP", "MXN"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="btn tiny ghost"
              style={{
                background: filter === f ? "var(--ink)" : "transparent",
                color: filter === f ? "var(--paper)" : "var(--ink)"
              }}
            >{f === "all" ? "all routes" : "→ " + f}</button>
          ))}
          <button
            className="btn tiny ghost"
            onClick={() => setPaused(p => !p)}
            style={{ marginLeft: "auto" }}
          >{paused ? "▶ resume stream" : "⏸ pause stream"}</button>
        </div>

        <div className="feed-wrap">
          <div className="feed">
            <div className="feed-head">
              <span>tx · route · amount · status</span>
              <span className="live"><i></i>live · {filtered.length} shown</span>
            </div>
            <ul>
              {filtered.map((r, i) => (
                <li key={r.id + i} className={r.isNew ? "new" : ""}>
                  <span className="id">{r.id}</span>
                  <span className="route">
                    <span className={"chip " + r.from.toLowerCase()}>{r.from}</span>
                    <span style={{ color: "var(--ink-mute)" }}>→</span>
                    <span className={"chip " + r.to.toLowerCase()}>{r.to}</span>
                  </span>
                  <span className="amt">{Number(r.fiat).toLocaleString()} {r.to}</span>
                  <span className={"status " + r.cls}>{r.status}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="stats">
            <StatCard
              label="30-day volume"
              value={"$" + fmt(totalVol * 30)}
              delta="+24.8% vs last period"
            />
            <StatCard
              label="settlements witnessed"
              value={(142804 + rows.length).toLocaleString()}
              delta="+1,284 today"
              variant="bars"
            />
            <StatCard
              label="median settlement time"
              value="87s"
              delta="p95 · 2m 14s"
              variant="flat"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value, delta, variant = "line" }) {
  const bars = useMemo(() => Array.from({ length: 24 }, () => 30 + Math.random() * 70), []);
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="val">{value}</div>
      <div className="delta">{delta}</div>
      <svg className="spark" viewBox="0 0 240 44" preserveAspectRatio="none">
        {variant === "line" && (
          <>
            <path
              d={"M 0 " + (44 - bars[0] * 0.4) + " " + bars.map((b, i) => "L " + (i * 10) + " " + (44 - b * 0.4)).join(" ")}
              fill="none" stroke="var(--accent)" strokeWidth="1.5"
            />
            <path
              d={"M 0 44 " + bars.map((b, i) => "L " + (i * 10) + " " + (44 - b * 0.4)).join(" ") + " L 240 44 Z"}
              fill="var(--accent)" opacity="0.1"
            />
          </>
        )}
        {variant === "bars" && bars.map((b, i) => (
          <rect key={i} x={i * 10} y={44 - b * 0.35} width="6" height={b * 0.35} fill="var(--accent-2)" opacity="0.85" />
        ))}
        {variant === "flat" && (
          <>
            <line x1="0" y1="22" x2="240" y2="22" stroke="var(--rule)" strokeDasharray="2 4" />
            {bars.map((b, i) => (
              <circle key={i} cx={i * 10 + 3} cy={22 + Math.sin(i * 0.7) * 8} r="1.6" fill="var(--accent-3)" />
            ))}
          </>
        )}
      </svg>
    </div>
  );
}

// ============================================================
// WAITLIST FORM
// ============================================================
function Waitlist() {
  const [role, setRole] = useState("trader");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("IN");
  const [vol, setVol] = useState(25000);
  const [note, setNote] = useState("");
  const [err, setErr] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [queuePos, setQueuePos] = useState(null);

  const validate = () => {
    const e = {};
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) e.email = "enter a valid email";
    return e;
  };

  const submit = (ev) => {
    ev.preventDefault();
    const e = validate();
    setErr(e);
    if (Object.keys(e).length) return;
    setQueuePos(randInt(482, 1284));
    setSubmitted(true);
  };

  return (
    <section className="section" id="waitlist" style={{ paddingBottom: 60 }}>
      <div className="wrap">
        <div className="waitlist">
          <div className="waitlist-grid">
            <div>
              <div className="eyebrow" style={{ color: "rgba(242,234,219,0.65)" }}>
                <span className="dot"></span>
                <span>Private beta · Q2 2026</span>
              </div>
              <h2>
                Get on the <em>early bench.</em>
              </h2>
              <p>
                We're onboarding P2P desks, remittance builders, and curious
                individuals first. Tell us who you are and we'll route you to
                the right cohort.
              </p>
              <div style={{ display: "flex", gap: 28, marginTop: 32, fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(242,234,219,0.55)" }}>
                <div>
                  <div style={{ fontFamily: "var(--serif)", fontSize: 32, color: "var(--paper)", fontWeight: 300, textTransform: "none", letterSpacing: "-0.02em" }}>2,847</div>
                  on waitlist
                </div>
                <div>
                  <div style={{ fontFamily: "var(--serif)", fontSize: 32, color: "var(--paper)", fontWeight: 300, textTransform: "none", letterSpacing: "-0.02em" }}>42</div>
                  countries
                </div>
                <div>
                  <div style={{ fontFamily: "var(--serif)", fontSize: 32, color: "var(--paper)", fontWeight: 300, textTransform: "none", letterSpacing: "-0.02em" }}>12</div>
                  fiat rails
                </div>
              </div>
            </div>

            <div className="form-card">
              {submitted ? (
                <div className="success-card">
                  <div className="stamp">✓</div>
                  <h3>Sealed & delivered.</h3>
                  <p style={{ color: "var(--ink-mute)", fontSize: 14, marginTop: 4 }}>
                    We'll reach out to <strong style={{ color: "var(--ink)" }}>{email}</strong> with next steps.
                  </p>
                  <div className="queue" style={{ marginTop: 20 }}>Queue position · #{queuePos}</div>
                  <button
                    className="btn tiny ghost"
                    style={{ marginTop: 24 }}
                    onClick={() => { setSubmitted(false); setEmail(""); setNote(""); }}
                  >Submit another</button>
                </div>
              ) : (
                <form onSubmit={submit}>
                  <div className="form-row">
                    <label>I am a</label>
                    <div className="role-picker">
                      {[
                        { k: "trader", l: "Trader" },
                        { k: "builder", l: "Builder" },
                        { k: "curious", l: "Just curious" },
                      ].map(r => (
                        <button
                          key={r.k}
                          type="button"
                          onClick={() => setRole(r.k)}
                          className={role === r.k ? "active" : ""}
                        >{r.l}</button>
                      ))}
                    </div>
                  </div>

                  <div className="form-row">
                    <label>Email</label>
                    <input
                      className={"input" + (err.email ? " error" : "")}
                      type="email"
                      placeholder="you@somewhere.xyz"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setErr({}); }}
                    />
                    {err.email && <div className="err">{err.email}</div>}
                  </div>

                  <div className="form-row">
                    <label>Primary corridor</label>
                    <select className="select" value={region} onChange={e => setRegion(e.target.value)}>
                      <option value="IN">India · UPI / IMPS</option>
                      <option value="BR">Brazil · Pix</option>
                      <option value="EU">Europe · SEPA</option>
                      <option value="NG">Nigeria · NIBSS</option>
                      <option value="MX">Mexico · SPEI</option>
                      <option value="PH">Philippines · InstaPay</option>
                      <option value="KE">Kenya · M-Pesa</option>
                      <option value="XX">Other / multi-rail</option>
                    </select>
                  </div>

                  <div className="form-row">
                    <label>Expected monthly volume · ${vol.toLocaleString()}</label>
                    <input
                      type="range" min="500" max="500000" step="500"
                      className="volume-slider"
                      value={vol}
                      onChange={e => setVol(+e.target.value)}
                    />
                    <div className="slider-wrap">
                      <span>$500</span>
                      <span>$500K+</span>
                    </div>
                  </div>

                  {role === "builder" && (
                    <div className="form-row">
                      <label>What are you building? (optional)</label>
                      <input
                        className="input"
                        placeholder="A payroll tool, remittance app, OTC desk…"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                      />
                    </div>
                  )}

                  <button className="submit-btn" type="submit" disabled={!email}>
                    Apply for access →
                  </button>
                  <p style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "center", marginTop: 12, marginBottom: 0 }}>
                    No spam. Unsubscribe in one click.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// FAQ
// ============================================================
function FAQ() {
  const [open, setOpen] = useState(0);
  const items = [
    {
      q: "Who actually runs the oracle?",
      a: "A permissionless validator set. Anyone can stake collateral and run a node; attestations require a supermajority signature, and malicious signers get slashed. The protocol itself is neutral — we don't run validators."
    },
    {
      q: "Why not just use payment screenshots?",
      a: "Screenshots are trivially faked and require a human dispute loop. Our oracle reads directly from bank APIs, UPI webhooks, and payment-network feeds where available, then produces a signed cryptographic proof. No humans in the release path."
    },
    {
      q: "Which fiat rails are supported today?",
      a: "India (UPI, IMPS, NEFT), Brazil (Pix), Eurozone (SEPA Instant), Nigeria (NIBSS), Mexico (SPEI), Philippines (InstaPay), Kenya (M-Pesa). Seven more are in private testing."
    },
    {
      q: "Is there custody risk?",
      a: "None. Stablecoins live in audited escrow contracts; the oracle can only release to the pre-committed recipient address specified at trade creation. There is no admin key and no upgrade path that routes funds."
    },
    {
      q: "What does it cost?",
      a: "10 basis points on the stablecoin leg. No fees on the fiat side. Validator rewards come out of the protocol fee; there is no separate gas surcharge on the attestation call."
    },
  ];
  return (
    <section className="section" id="faq">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="section-num">§ 03 — Questions</div>
            <h2 className="section-title">The short answers.</h2>
          </div>
          <p className="section-kicker">
            Longer ones live in the whitepaper. If yours isn't here, drop us a
            line — we'll publish the good ones.
          </p>
        </div>
        <div className="faq-list">
          {items.map((it, i) => (
            <div key={i} className={"faq-item" + (open === i ? " open" : "")}>
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

// ============================================================
// FOOTER
// ============================================================
function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <a href="#" className="brand" style={{ fontSize: 22 }}>
              <span className="seal"></span>
              <span>settle.infra</span>
            </a>
            <p className="tagline" style={{ marginTop: 16 }}>
              A neutral attestation layer for crypto&thinsp;↔&thinsp;fiat settlement. Made with care, from many timezones.
            </p>
          </div>
          <div>
            <h4>Product</h4>
            <a href="#">Explorer</a>
            <a href="#">Terminal</a>
            <a href="#">Dashboard</a>
            <a href="#">API</a>
          </div>
          <div>
            <h4>Learn</h4>
            <a href="#">Docs</a>
            <a href="#">Whitepaper</a>
            <a href="#">Security</a>
            <a href="#">Audits</a>
          </div>
          <div>
            <h4>Connect</h4>
            <a href="#">Twitter / X</a>
            <a href="#">GitHub</a>
            <a href="#">Discord</a>
            <a href="#">Mirror blog</a>
          </div>
        </div>

        <div className="jumbo">
          <span>s</span><span>e</span><span>t</span><span>t</span><span>l</span><span>e</span><span className="it">.</span>
        </div>

        <div className="footer-legal">
          <span>© 2026 Settle Labs · Delaware C-Corp</span>
          <span>Crafted with ink + silicon · v0.9.2</span>
        </div>
      </div>
    </footer>
  );
}

// ============================================================
// TWEAKS
// ============================================================
function TweaksPanel({ tweaks, setTweak }) {
  const swatches = [
    { k: "terracotta", c: "#B8472C" },
    { k: "olive",      c: "#6B7A3E" },
    { k: "clay",       c: "#C98A58" },
    { k: "rose",       c: "#C98585" },
    { k: "ink",        c: "#1A1410" },
  ];
  return (
    <div className="tweaks open">
      <h5>Tweaks</h5>
      <div className="tweak-row">
        <span>Accent</span>
        <div className="swatches">
          {swatches.map(s => (
            <button
              key={s.k}
              className={"swatch" + (tweaks.accent === s.k ? " active" : "")}
              style={{ background: s.c }}
              onClick={() => setTweak("accent", s.k)}
              title={s.k}
            />
          ))}
        </div>
      </div>
      <div className="tweak-row">
        <span>Hero layout</span>
        <div className="seg">
          {["A", "B", "C"].map(h => (
            <button
              key={h}
              className={tweaks.heroLayout === h ? "active" : ""}
              onClick={() => setTweak("heroLayout", h)}
            >{h}</button>
          ))}
        </div>
      </div>
      <div className="tweak-row">
        <span>Mode</span>
        <div className="seg">
          <button className={!tweaks.dark ? "active" : ""} onClick={() => setTweak("dark", false)}>Day</button>
          <button className={tweaks.dark ? "active" : ""} onClick={() => setTweak("dark", true)}>Dusk</button>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        Live — saved to disk
      </div>
    </div>
  );
}

// ============================================================
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
