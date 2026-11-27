import type { Metadata } from 'next';
import Link from 'next/link';
import { Window } from '@/components/Window';
import { Notice } from '@/components/Notice';
import { TEMPLATES } from '@/lib/blocks';
import { THEME_PRESETS } from '@/lib/wikiTheme';
import { createWiki } from '../../wiki/actions';

export const metadata: Metadata = { title: 'Nova wiki' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const ERRORS: Record<string, string> = {
  titulo: 'Dê um título à wiki.',
  falhou: 'Não foi possível criar a wiki. Tente novamente.',
};

const VISIBILITY = [
  { value: 'private', label: 'Privada', hint: 'Só você vê.' },
  { value: 'friends', label: 'Amigos', hint: 'Seus amigos podem ler.' },
  { value: 'unlisted', label: 'Não listada', hint: 'Só quem receber o link.' },
  { value: 'public', label: 'Pública', hint: 'Qualquer pessoa com conta.' },
];

export default async function NovaWikiPage({ searchParams }: Props) {
  const sp = await searchParams;
  const erro = Array.isArray(sp.erro) ? sp.erro[0] : sp.erro;

  return (
    <main id="conteudo" className="page">
      <Window title="Nova wiki" icon="book" headingLevel={1}>
        <form action={createWiki} className="stack">
          <Link href="/criar">← Voltar para Criar</Link>
          <Notice error={erro ? ERRORS[erro] : undefined} />

          <div className="field">
            <label htmlFor="title">Sobre o que é a wiki?</label>
            <input id="title" name="title" type="text" required maxLength={120} placeholder="Ex.: Meus relógios" />
          </div>
          <div className="field">
            <label htmlFor="description">Descrição (opcional)</label>
            <input id="description" name="description" type="text" maxLength={300} />
          </div>

          <fieldset className="choice-group">
            <legend>Modelo</legend>
            <div className="choice-grid">
              {TEMPLATES.map((t, i) => (
                <label key={t.id} className="choice">
                  <input type="radio" name="template" value={t.id} defaultChecked={i === 0} />
                  <span className="choice__text">
                    <span className="choice__label">{t.label}</span>
                    <span className="choice__hint">{t.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="choice-group">
            <legend>Tema inicial</legend>
            <p className="muted" style={{ margin: '0 0 8px' }}>
              Você pode personalizar cores, padrão de fundo e fonte depois.
            </p>
            <div className="choice-grid">
              {THEME_PRESETS.map((p, i) => (
                <label key={p.id} className="choice">
                  <input type="radio" name="preset" value={p.id} defaultChecked={i === 0} />
                  <span className="choice__text">
                    <span className="choice__label">{p.label}</span>
                    <span className="swatches" aria-hidden="true">
                      <span style={{ background: p.theme.bg }} />
                      <span style={{ background: p.theme.surface }} />
                      <span style={{ background: p.theme.text }} />
                      <span style={{ background: p.theme.accent }} />
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="choice-group">
            <legend>Quem pode ver</legend>
            <div className="choice-grid">
              {VISIBILITY.map((v, i) => (
                <label key={v.value} className="choice">
                  <input type="radio" name="visibility" value={v.value} defaultChecked={i === 0} />
                  <span className="choice__text">
                    <span className="choice__label">{v.label}</span>
                    <span className="choice__hint">{v.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn--primary">
              Criar wiki
            </button>
          </div>
        </form>
      </Window>
    </main>
  );
}
