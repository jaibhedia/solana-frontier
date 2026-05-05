'use client';

import { useState, useEffect } from 'react';
import type { StatCardProps } from '@/types';

export default function StatCard({ label, value, delta, variant = 'line' }: StatCardProps) {
  const [bars, setBars] = useState<number[] | null>(null);
  useEffect(() => {
    setBars(Array.from({ length: 24 }, () => 30 + Math.random() * 70));
  }, []);

  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="val">{value}</div>
      <div className="delta">{delta}</div>
      <svg className="spark" viewBox="0 0 240 44" preserveAspectRatio="none">
        {bars !== null && variant === 'line' && (
          <>
            <path
              d={'M 0 ' + (44 - bars[0] * 0.4) + ' ' + bars.map((b, i) => 'L ' + (i * 10) + ' ' + (44 - b * 0.4)).join(' ')}
              fill="none" stroke="var(--accent)" strokeWidth="1.5"
            />
            <path
              d={'M 0 44 ' + bars.map((b, i) => 'L ' + (i * 10) + ' ' + (44 - b * 0.4)).join(' ') + ' L 240 44 Z'}
              fill="var(--accent)" opacity="0.1"
            />
          </>
        )}
        {bars !== null && variant === 'bars' && bars.map((b, i) => (
          <rect key={i} x={i * 10} y={44 - b * 0.35} width="6" height={b * 0.35} fill="var(--accent-2)" opacity="0.85" />
        ))}
        {bars !== null && variant === 'flat' && (
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
