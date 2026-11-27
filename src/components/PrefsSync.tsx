'use client';

import { useEffect } from 'react';
import { DEFAULT_PREFS, PREFS_KEY, applyPrefs, type A11yPrefs } from '@/lib/prefs';

/** Leva as preferências salvas na conta para este navegador (ex.: primeiro login em um dispositivo novo). */
export function PrefsSync({ saved }: { saved: Partial<A11yPrefs> | null }) {
  useEffect(() => {
    if (!saved || Object.keys(saved).length === 0) return;
    const merged = { ...DEFAULT_PREFS, ...saved };
    try {
      const current = localStorage.getItem(PREFS_KEY);
      const serialized = JSON.stringify(merged);
      if (current === serialized) return;
      localStorage.setItem(PREFS_KEY, serialized);
    } catch {
      /* ignora */
    }
    applyPrefs(merged);
  }, [saved]);

  return null;
}
