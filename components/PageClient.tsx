'use client';

import { useState, useEffect } from 'react';
import Nav from './Nav';
import Hero from './Hero';
import Ticker from './Ticker';
import HowItWorks from './HowItWorks';
import LiveExplorer from './LiveExplorer';
import DemoVideo from './DemoVideo';
import Waitlist from './Waitlist';
import FAQ from './FAQ';
import Footer from './Footer';
import TweaksPanel from './TweaksPanel';
import { TWEAK_DEFAULTS, ACCENT_MAP } from '@/lib/constants';
import type { Tweaks } from '@/types';

export default function PageClient() {
  const [tweaks, setTweaks] = useState<Tweaks>(TWEAK_DEFAULTS);
  const [editMode, setEditMode] = useState(false);

  // editmode protocol
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data || {};
      if (d.type === '__activate_edit_mode') setEditMode(true);
      if (d.type === '__deactivate_edit_mode') setEditMode(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // apply accent + hero layout
  useEffect(() => {
    const root = document.documentElement;
    const map = ACCENT_MAP[tweaks.accent] ?? ACCENT_MAP.terracotta;
    Object.entries(map).forEach(([k, v]) => root.style.setProperty(k, v));
    document.body.dataset.hero = tweaks.heroLayout;
  }, [tweaks]);

  const setTweak = <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => {
    const next = { ...tweaks, [key]: value };
    setTweaks(next);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: value } }, '*');
  };

  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Ticker />
        <HowItWorks />
        <LiveExplorer />
        <DemoVideo />
        <Waitlist />
        <FAQ />
      </main>
      <Footer />
      {editMode && <TweaksPanel tweaks={tweaks} setTweak={setTweak} />}
    </>
  );
}
