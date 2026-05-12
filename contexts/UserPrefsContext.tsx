'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

const LS_KEY = 'uwu_country_pref';

interface UserPrefs {
  country: string | null;
}

interface UserPrefsCtx {
  prefs: UserPrefs;
  setCountry: (country: string) => void;
}

const UserPrefsContext = createContext<UserPrefsCtx>({
  prefs: { country: null },
  setCountry: () => {},
});

export function UserPrefsProvider({ children }: { children: React.ReactNode }) {
  const { publicKey } = useWallet();
  const [prefs, setPrefs] = useState<UserPrefs>({ country: null });

  // Load from localStorage on mount (instant, no flicker)
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
    if (stored) setPrefs({ country: stored });
  }, []);

  // When wallet connects, fetch Redis prefs (Redis wins over localStorage)
  useEffect(() => {
    if (!publicKey) return;
    fetch(`/api/user/prefs?wallet=${publicKey.toBase58()}`)
      .then(r => r.json())
      .then((d: { country: string | null }) => {
        if (d.country) {
          setPrefs({ country: d.country });
          if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, d.country);
        }
      })
      .catch(() => {});
  }, [publicKey]);

  const setCountry = useCallback((country: string) => {
    setPrefs({ country });
    if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, country);
    if (publicKey) {
      fetch('/api/user/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: publicKey.toBase58(), country }),
      }).catch(() => {});
    }
  }, [publicKey]);

  return (
    <UserPrefsContext.Provider value={{ prefs, setCountry }}>
      {children}
    </UserPrefsContext.Provider>
  );
}

export function useUserPrefs() {
  return useContext(UserPrefsContext);
}
