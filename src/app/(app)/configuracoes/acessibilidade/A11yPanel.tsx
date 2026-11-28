'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_PREFS, PREFS_KEY, THEME_OPTIONS, applyPrefs, type A11yPrefs, type ThemeId } from '@/lib/prefs';

type Props = { userId: string; saved: Record<string, unknown> };

const FONT_SCALES = [0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];

export function A11yPanel({ userId, saved }: Props) {
  const [prefs, setPrefs] = useState<A11yPrefs>(DEFAULT_PREFS);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const router = useRouter();

  // Prioridade: preferências da conta > preferências deste navegador > padrão.
  useEffect(() => {
    let local: Partial<A11yPrefs> = {};
    try {
      local = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    } catch {
      /* ignora */
    }
    const merged = { ...DEFAULT_PREFS, ...local, ...(saved as Partial<A11yPrefs>) };
    setPrefs(merged);
    applyPrefs(merged);
  }, [saved]);

  const update = <K extends keyof A11yPrefs>(key: K, value: A11yPrefs[K]) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    applyPrefs(next); // pré-visualização imediata
    setStatus('idle');
  };

  const save = async () => {
    setStatus('saving');
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* ignora */
    }
    const { error } = await createClient().from('profiles').update({ a11y_prefs: prefs }).eq('id', userId);
    if (error) {
      setStatus('error');
      return;
    }
    setStatus('saved');
    router.push('/configuracoes?aviso=acessibilidade-salva');
  };

  const reset = () => {
    setPrefs(DEFAULT_PREFS);
    applyPrefs(DEFAULT_PREFS);
    setStatus('idle');
  };

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <p className="muted" style={{ margin: 0 }}>
        As mudanças aparecem na hora. Salve para aplicar em todos os seus dispositivos.
      </p>

      <fieldset className="stack">
        <legend>Tema</legend>
        {THEME_OPTIONS.map((t) => (
          <label key={t.id} className="check">
            <input
              type="radio"
              name="theme"
              value={t.id}
              checked={prefs.theme === t.id}
              onChange={() => update('theme', t.id as ThemeId)}
            />
            <span>{t.label}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="stack">
        <legend>Leitura</legend>
        <div className="field">
          <label htmlFor="fontScale">Tamanho do texto</label>
          <select
            id="fontScale"
            value={prefs.fontScale}
            onChange={(e) => update('fontScale', Number(e.target.value))}
          >
            {FONT_SCALES.map((s) => (
              <option key={s} value={s}>
                {Math.round(s * 100)}%
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="font">Fonte</label>
          <select id="font" value={prefs.font} onChange={(e) => update('font', e.target.value as A11yPrefs['font'])}>
            <option value="sistema">Padrão do sistema</option>
            <option value="atkinson">Atkinson Hyperlegible (alta legibilidade)</option>
          </select>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={prefs.lineSpacing === 'amplo'}
            onChange={(e) => update('lineSpacing', e.target.checked ? 'amplo' : 'normal')}
          />
          <span>Espaçamento amplo entre linhas, letras e palavras</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={prefs.readingMode} onChange={(e) => update('readingMode', e.target.checked)} />
          <span>Modo leitura: exibir páginas de outras pessoas com o tema acessível padrão</span>
        </label>
      </fieldset>

      <fieldset className="stack">
        <legend>Conforto visual</legend>
        <label className="check">
          <input type="checkbox" checked={prefs.reduceMotion} onChange={(e) => update('reduceMotion', e.target.checked)} />
          <span>Reduzir movimento (desativa animações e pausa GIFs)</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={prefs.reduceTransparency}
            onChange={(e) => update('reduceTransparency', e.target.checked)}
          />
          <span>Reduzir transparência (troca o vidro Aero por superfícies sólidas)</span>
        </label>
      </fieldset>

      <div className="row">
        <button type="submit" className="btn btn--primary" disabled={status === 'saving'}>
          {status === 'saving' ? 'Salvando…' : 'Salvar preferências'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={reset}>
          Restaurar padrão
        </button>
      </div>
      <p role="status" aria-live="polite" className={status === 'error' ? 'notice notice--error' : 'muted'}>
        {status === 'saved' && 'Preferências salvas.'}
        {status === 'error' && 'Não foi possível salvar na conta. As preferências ficaram salvas neste navegador.'}
      </p>
    </form>
  );
}
