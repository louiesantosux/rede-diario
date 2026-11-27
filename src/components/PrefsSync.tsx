'use client';

import { useEffect } from 'react';
import { DEFAULT_PREFS, PREFS_KEY, applyPrefs, type A11yPrefs } from '@/lib/prefs';
import { UI_PREFS_KEY, applyUiPrefs, sanitizeUiPrefs } from '@/lib/uiPrefs';

/**
 * Leva as preferências salvas na conta para este navegador (ex.: primeiro login
 * em um dispositivo novo): acessibilidade e aparência do site.
 */
export function PrefsSync({ saved, ui }: { saved: Partial<A11yPrefs> | null; ui?: unknown }) {
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

  useEffect(() => {
    if (!ui || typeof ui !== 'object' || Object.keys(ui).length === 0) return;
    const clean = sanitizeUiPrefs(ui);
    try {
      const serialized = JSON.stringify(clean);
      if (localStorage.getItem(UI_PREFS_KEY) === serialized) return;
      localStorage.setItem(UI_PREFS_KEY, serialized);
    } catch {
      /* ignora */
    }
    applyUiPrefs(clean);
  }, [ui]);

  return null;
}
