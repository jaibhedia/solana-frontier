'use client';

import { useState, useEffect } from 'react';

export default function Waitlist() {
  const [role, setRole]       = useState('trader');
  const [email, setEmail]     = useState('');
  const [region, setRegion]   = useState('IN');
  const [vol, setVol]         = useState(25000);
  const [note, setNote]       = useState('');
  const [err, setErr]         = useState<{ email?: string }>({});
  const [submitted, setSubmitted] = useState(false);
  const [queuePos, setQueuePos]   = useState<number | null>(null);
  const [loading, setLoading]     = useState(false);
  const [count, setCount]         = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/waitlist')
      .then(r => r.json())
      .then(d => setCount(d.count ?? null))
      .catch(() => {});
  }, []);

  const validate = () => {
    const e: { email?: string } = {};
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) e.email = 'enter a valid email';
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErr(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, region, volume: vol, note }),
      });
      const data = await res.json();
      if (data.ok || data.alreadyOnList) {
        setQueuePos(data.position ?? null);
        setSubmitted(true);
        setCount(c => c !== null ? c + (data.alreadyOnList ? 0 : 1) : null);
      } else {
        setErr({ email: data.error ?? 'Something went wrong' });
      }
    } catch {
      setErr({ email: 'Network error — please try again' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section" id="waitlist" style={{ paddingBottom: 60 }}>
      <div className="wrap">
        <div className="waitlist">
          <div className="waitlist-grid">
            <div>
              <div className="eyebrow" style={{ color: 'rgba(242,234,219,0.65)' }}>
                <span className="dot"></span>
                <span>Private beta · Q2 2026</span>
              </div>
              <h2>
                Get on the <em>early bench.</em>
              </h2>
              <p>
                We&apos;re onboarding P2P desks, remittance builders, and curious
                individuals first. Tell us who you are and we&apos;ll route you to
                the right cohort.
              </p>
              {count !== null && count > 0 && (
                <div style={{ display: 'flex', gap: 28, marginTop: 32, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(242,234,219,0.55)' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 32, color: 'var(--paper)', fontWeight: 300, textTransform: 'none', letterSpacing: '-0.02em' }}>{count.toLocaleString()}</div>
                    on waitlist
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 32, color: 'var(--paper)', fontWeight: 300, textTransform: 'none', letterSpacing: '-0.02em' }}>12</div>
                    fiat rails
                  </div>
                </div>
              )}
            </div>

            <div className="form-card">
              {submitted ? (
                <div className="success-card">
                  <div className="stamp">✓</div>
                  <h3>Sealed &amp; delivered.</h3>
                  <p style={{ color: 'var(--ink-mute)', fontSize: 14, marginTop: 4 }}>
                    We&apos;ll reach out to <strong style={{ color: 'var(--ink)' }}>{email}</strong> with next steps.
                  </p>
                  {queuePos !== null && (
                    <div className="queue" style={{ marginTop: 20 }}>Queue position · #{queuePos}</div>
                  )}
                  <button
                    className="btn tiny ghost"
                    style={{ marginTop: 24 }}
                    onClick={() => { setSubmitted(false); setEmail(''); setNote(''); }}
                  >Submit another</button>
                </div>
              ) : (
                <form onSubmit={submit} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="form-row">
                    <label>I am a</label>
                    <div className="role-picker">
                      {[
                        { k: 'trader', l: 'Trader' },
                        { k: 'builder', l: 'Builder' },
                        { k: 'curious', l: 'Just curious' },
                      ].map(r => (
                        <button
                          key={r.k}
                          type="button"
                          onClick={() => setRole(r.k)}
                          className={role === r.k ? 'active' : ''}
                        >{r.l}</button>
                      ))}
                    </div>
                  </div>

                  <div className="form-row">
                    <label>Email</label>
                    <input
                      className={'input' + (err.email ? ' error' : '')}
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

                  {role === 'builder' && (
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

                  <div style={{ marginTop: 'auto' }}>
                    <button className="submit-btn" type="submit" disabled={!email || loading}>
                      {loading ? 'Submitting…' : 'Apply for access →'}
                    </button>
                    <p style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center', marginTop: 12, marginBottom: 0 }}>
                      No spam. Unsubscribe in one click.
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
