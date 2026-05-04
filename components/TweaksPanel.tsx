'use client';

import type { TweaksPanelProps, AccentKey, HeroLayout } from '@/types';

const swatches: { k: AccentKey; c: string }[] = [
  { k: 'terracotta', c: '#B8472C' },
  { k: 'olive',      c: '#6B7A3E' },
  { k: 'clay',       c: '#C98A58' },
  { k: 'rose',       c: '#C98585' },
  { k: 'ink',        c: '#1A1410' },
];

export default function TweaksPanel({ tweaks, setTweak }: TweaksPanelProps) {
  return (
    <div className="tweaks open">
      <h5>Tweaks</h5>
      <div className="tweak-row">
        <span>Accent</span>
        <div className="swatches">
          {swatches.map(s => (
            <button
              key={s.k}
              className={'swatch' + (tweaks.accent === s.k ? ' active' : '')}
              style={{ background: s.c }}
              onClick={() => setTweak('accent', s.k)}
              title={s.k}
            />
          ))}
        </div>
      </div>
      <div className="tweak-row">
        <span>Hero layout</span>
        <div className="seg">
          {(['A', 'B', 'C'] as HeroLayout[]).map(h => (
            <button
              key={h}
              className={tweaks.heroLayout === h ? 'active' : ''}
              onClick={() => setTweak('heroLayout', h)}
            >{h}</button>
          ))}
        </div>
      </div>
      <div className="tweak-row">
        <span>Mode</span>
        <div className="seg">
          <button className={!tweaks.dark ? 'active' : ''} onClick={() => setTweak('dark', false)}>Day</button>
          <button className={tweaks.dark ? 'active' : ''} onClick={() => setTweak('dark', true)}>Dusk</button>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Live — saved to disk
      </div>
    </div>
  );
}
