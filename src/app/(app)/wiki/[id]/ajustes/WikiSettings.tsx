'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Window } from '@/components/Window';
import { Notice } from '@/components/Notice';
import { contrastLevel } from '@/lib/contrast';
import {
  FONTS,
  FONT_LABEL,
  PATTERNS,
  PATTERN_LABEL,
  THEME_PRESETS,
  themeChecks,
  themePasses,
  themeStyle,
  type WikiTheme,
} from '@/lib/wikiTheme';
import { deleteWiki, saveWikiSettings, type FormState } from '../../actions';

type Props = {
  wiki: { id: string; title: string; description: string; visibility: string; theme: WikiTheme };
  confirmError: boolean;
};

const COLOR_FIELDS: { key: 'bg' | 'surface' | 'text' | 'accent'; label: string }[] = [
  { key: 'bg', label: 'Fundo da página' },
  { key: 'surface', label: 'Fundo do conteúdo' },
  { key: 'text', label: 'Texto' },
  { key: 'accent', label: 'Links e destaques' },
];

export function WikiSettings({ wiki, confirmError }: Props) {
  const [theme, setTheme] = useState<WikiTheme>(wiki.theme);
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveWikiSettings, undefined);
  const checks = themeChecks(theme);
  const passes = themePasses(theme);

  const set = <K extends keyof WikiTheme>(key: K, value: WikiTheme[K]) => setTheme((t) => ({ ...t, [key]: value }));

  const submit = (form: FormData) => {
    form.set('theme', JSON.stringify(theme));
    formAction(form);
  };

  return (
    <>
      <Window title={`Aparência · ${wiki.title}`} icon="gear" headingLevel={1}>
        <form action={submit} className="stack">
          <input type="hidden" name="wikiId" value={wiki.id} />
          <Link href={`/wiki/${wiki.id}`}>← Voltar para a wiki</Link>
          <Notice error={state?.error} ok={state?.ok} />

          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '1 1 240px' }}>
              <label htmlFor="title">Título</label>
              <input id="title" name="title" type="text" required maxLength={120} defaultValue={wiki.title} />
            </div>
            <div className="field" style={{ flex: '0 1 200px' }}>
              <label htmlFor="visibility">Quem pode ver</label>
              <select id="visibility" name="visibility" defaultValue={wiki.visibility}>
                <option value="private">Só eu</option>
                <option value="friends">Amigos</option>
                <option value="unlisted">Quem tiver o link</option>
                <option value="public">Público</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="description">Descrição</label>
            <input id="description" name="description" type="text" maxLength={300} defaultValue={wiki.description} />
          </div>

          <div className="theme-editor">
            <div className="stack">
              <fieldset className="choice-group">
                <legend>Começar de um tema pronto</legend>
                <div className="preset-row">
                  {THEME_PRESETS.map((p) => (
                    <button key={p.id} type="button" className="preset" onClick={() => setTheme(p.theme)}>
                      <span className="swatches" aria-hidden="true">
                        <span style={{ background: p.theme.bg }} />
                        <span style={{ background: p.theme.surface }} />
                        <span style={{ background: p.theme.text }} />
                        <span style={{ background: p.theme.accent }} />
                      </span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="choice-group">
                <legend>Cores</legend>
                <div className="color-grid">
                  {COLOR_FIELDS.map((f) => (
                    <label key={f.key} className="color-field">
                      <input type="color" value={theme[f.key]} onChange={(e) => set(f.key, e.target.value)} />
                      <span>
                        {f.label}
                        <code>{theme[f.key]}</code>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="row" style={{ alignItems: 'flex-end' }}>
                <div className="field" style={{ flex: '1 1 160px' }}>
                  <label htmlFor="pattern">Padrão de fundo</label>
                  <select id="pattern" value={theme.pattern} onChange={(e) => set('pattern', e.target.value as WikiTheme['pattern'])}>
                    {PATTERNS.map((p) => (
                      <option key={p} value={p}>
                        {PATTERN_LABEL[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ flex: '1 1 160px' }}>
                  <label htmlFor="font">Fonte</label>
                  <select id="font" value={theme.font} onChange={(e) => set('font', e.target.value as WikiTheme['font'])}>
                    {FONTS.map((f) => (
                      <option key={f} value={f}>
                        {FONT_LABEL[f]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="contrast-report" role="status" aria-live="polite">
                <p className="contrast-report__title">Verificação de contraste (recomendação)</p>
                <ul>
                  {checks.map((c) => {
                    const level = contrastLevel(c.ratio);
                    return (
                      <li key={c.label} className={level === 'insuficiente' ? 'is-bad' : 'is-ok'}>
                        <span>{c.label}</span>
                        <strong>
                          {c.ratio.toFixed(1).replace('.', ',')}:1 · {level === 'insuficiente' ? 'abaixo do recomendado' : level}
                        </strong>
                      </li>
                    );
                  })}
                </ul>
                {!passes && (
                  <p style={{ margin: 0 }}>
                    Recomendação: pelo menos 4,5:1 para que mais pessoas consigam ler. Você pode salvar mesmo assim; quem
                    precisar pode ativar o Modo leitura.
                  </p>
                )}
              </div>
            </div>

            <div>
              <p className="muted" style={{ margin: '0 0 6px', fontSize: '0.875rem' }}>
                Prévia
              </p>
              <div
                className={`wiki-surface wiki-preview wiki-pattern--${theme.pattern} wiki-font--${theme.font}`}
                style={themeStyle(theme)}
              >
                <div className="wiki-paper">
                  <h2 className="wiki-page__title">Minha coleção</h2>
                  <p style={{ margin: '0 0 8px' }}>
                    Um texto de exemplo com um <a href="#previa">link destacado</a> para conferir a leitura.
                  </p>
                  <div className="collection__item">
                    <span className="collection__name">Item de exemplo</span>
                    <span className="collection__note">Uma nota curta</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn--primary" disabled={pending}>
              {pending ? 'Salvando…' : 'Salvar aparência'}
            </button>
          </div>
        </form>
      </Window>

      <Window title="Excluir wiki" icon="window">
        <form action={deleteWiki} className="stack">
          <input type="hidden" name="wikiId" value={wiki.id} />
          <Notice error={confirmError ? 'O nome digitado não confere.' : undefined} />
          <p style={{ margin: 0 }}>
            Apaga a wiki e todas as páginas. Posts vinculados continuam existindo, mas saem do blog.
          </p>
          <div className="field">
            <label htmlFor="confirm">Digite o título da wiki para confirmar</label>
            <input id="confirm" name="confirm" type="text" autoComplete="off" />
          </div>
          <div>
            <button type="submit" className="btn btn--danger">
              Excluir wiki
            </button>
          </div>
        </form>
      </Window>
    </>
  );
}
