'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ColorPicker } from '@/components/ColorPicker';
import { contrastLevel, contrastRatio } from '@/lib/contrast';
import { DEFAULT_PREFS, PREFS_KEY, THEME_OPTIONS, applyPrefs, type A11yPrefs, type ThemeId } from '@/lib/prefs';
import {
  ACCENT_SWATCHES,
  DEFAULT_UI,
  UI_CORNERS,
  UI_FONTS,
  UI_PREFS_KEY,
  WALLPAPER_SWATCHES,
  applyUiPrefs,
  sanitizeUiPrefs,
  type UiPrefs,
} from '@/lib/uiPrefs';

type Props = { userId: string; savedUi: unknown; savedA11y: unknown };

const readLocal = (key: string) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
};

/**
 * Cores, papel de parede, fonte e cantos da interface inteira, só para esta pessoa.
 * As mudanças aparecem na hora; salvar leva a escolha para todos os dispositivos.
 */
export function SiteAppearance({ userId, savedUi, savedA11y }: Props) {
  const [ui, setUi] = useState<UiPrefs>(DEFAULT_UI);
  const [a11y, setA11y] = useState<A11yPrefs>(DEFAULT_PREFS);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const router = useRouter();

  useEffect(() => {
    const localUi = readLocal(UI_PREFS_KEY);
    const accountUi = (savedUi && typeof savedUi === 'object' ? savedUi : {}) as Record<string, unknown>;
    setUi(sanitizeUiPrefs({ ...localUi, ...accountUi }));
    const accountA11y = (savedA11y && typeof savedA11y === 'object' ? savedA11y : {}) as Partial<A11yPrefs>;
    setA11y({ ...DEFAULT_PREFS, ...(readLocal(PREFS_KEY) as Partial<A11yPrefs>), ...accountA11y });
  }, [savedUi, savedA11y]);

  const preview = (next: UiPrefs) => {
    setUi(next);
    try {
      localStorage.setItem(UI_PREFS_KEY, JSON.stringify(next));
    } catch {
      /* ignora */
    }
    applyUiPrefs(next);
    setStatus('idle');
  };
  const set = <K extends keyof UiPrefs>(key: K, value: UiPrefs[K]) => preview({ ...ui, [key]: value });

  const setBase = (theme: ThemeId) => {
    const next = { ...a11y, theme };
    setA11y(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* ignora */
    }
    applyPrefs(next); // também reaplica as cores escolhidas aqui
    setStatus('idle');
  };

  const save = async () => {
    setStatus('saving');
    const { error } = await createClient().from('profiles').update({ theme: ui, a11y_prefs: a11y }).eq('id', userId);
    if (error) {
      setStatus('error');
      return;
    }
    setStatus('saved');
    // Volta para a tela anterior (Meu espaço).
    router.push('/meu-espaco?aviso=aparencia-salva');
  };

  const reset = () => preview({ ...DEFAULT_UI });

  const highContrast = a11y.theme === 'alto-contraste';
  const accentRatio = ui.accent ? contrastRatio(ui.accent, '#ffffff') : null;

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <p className="muted" style={{ margin: 0 }}>
        Muda as cores, a fonte e os cantos de todas as telas, só para você. Aparece na hora; salve para levar a
        outros dispositivos. Temas prontos chegam em breve.
      </p>

      <div className="field" style={{ maxWidth: 320 }}>
        <label htmlFor="ui-base">Tema base</label>
        <select id="ui-base" value={a11y.theme} onChange={(e) => setBase(e.target.value as ThemeId)}>
          {THEME_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      {highContrast && (
        <p className="notice" role="status" style={{ margin: 0 }}>
          Com o Alto contraste ativo, as cores abaixo ficam guardadas mas não são aplicadas.
        </p>
      )}

      <fieldset className="choice-group">
        <legend>Cor de destaque</legend>
        <div className="swatch-row">
          <button type="button" className="swatch swatch--none" aria-pressed={!ui.accent} onClick={() => set('accent', null)}>
            Do tema
          </button>
          {ACCENT_SWATCHES.map((c) => (
            <button
              key={c.hex}
              type="button"
              className="swatch"
              aria-pressed={ui.accent === c.hex}
              aria-label={c.label}
              title={c.label}
              style={{ background: c.hex }}
              onClick={() => set('accent', c.hex)}
            />
          ))}
          <ColorPicker compact label="Outra cor de destaque" value={ui.accent ?? '#0a4c8c'} onChange={(hex) => set('accent', hex)} />
        </div>
        <small className="muted">
          Botões, links, abas e barras de título.
          {accentRatio !== null &&
            ` Contraste com fundo branco: ${accentRatio.toFixed(1).replace('.', ',')}:1 (${
              contrastLevel(accentRatio) === 'insuficiente' ? 'abaixo do recomendado para links' : contrastLevel(accentRatio)
            }).`}
        </small>
      </fieldset>

      <fieldset className="choice-group">
        <legend>Papel de parede</legend>
        <div className="swatch-row">
          <button
            type="button"
            className="swatch swatch--none"
            aria-pressed={!ui.wallpaper}
            onClick={() => set('wallpaper', null)}
          >
            Do tema
          </button>
          {WALLPAPER_SWATCHES.map((c) => (
            <button
              key={c.hex}
              type="button"
              className="swatch"
              aria-pressed={ui.wallpaper === c.hex}
              aria-label={c.label}
              title={c.label}
              style={{ background: c.hex }}
              onClick={() => set('wallpaper', c.hex)}
            />
          ))}
          <ColorPicker compact label="Outra cor de papel de parede" value={ui.wallpaper ?? '#cfe3f5'} onChange={(hex) => set('wallpaper', hex)} />
        </div>
      </fieldset>

      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '1 1 220px' }}>
          <label htmlFor="ui-font">Fonte da interface</label>
          <select id="ui-font" value={ui.font} onChange={(e) => set('font', e.target.value as UiPrefs['font'])}>
            {UI_FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 180px' }}>
          <label htmlFor="ui-corners">Cantos das janelas</label>
          <select id="ui-corners" value={ui.corners} onChange={(e) => set('corners', e.target.value as UiPrefs['corners'])}>
            {UI_CORNERS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {a11y.font === 'atkinson' && (
        <small className="muted">
          A fonte Atkinson, escolhida em <Link href="/configuracoes/acessibilidade">Acessibilidade</Link>, tem prioridade.
        </small>
      )}

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="btn btn--ghost" onClick={reset}>
          Restaurar padrão
        </button>
        <div className="row">
          <span role="status" className="muted" style={{ fontSize: '0.875rem' }}>
            {status === 'saving' ? 'Salvando…' : status === 'saved' ? 'Salvo.' : status === 'error' ? 'Não foi possível salvar.' : ''}
          </span>
          <button type="submit" className="btn btn--primary" disabled={status === 'saving'}>
            Salvar aparência
          </button>
        </div>
      </div>
    </form>
  );
}
