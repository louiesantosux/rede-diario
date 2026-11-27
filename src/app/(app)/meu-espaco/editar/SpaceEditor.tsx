'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { Window } from '@/components/Window';
import { Notice } from '@/components/Notice';
import { Icon } from '@/components/Icon';
import { RichEditor } from '@/components/editor/RichEditor';
import { ImagePicker } from '@/components/wiki/ImagePicker';
import { createClient } from '@/lib/supabase/client';
import { signedUrls } from '@/lib/mediaClient';
import { contrastLevel } from '@/lib/contrast';
import { FONTS, FONT_LABEL, PATTERNS, PATTERN_LABEL, THEME_PRESETS, themeChecks, themePasses } from '@/lib/wikiTheme';
import {
  BG_FITS,
  BG_FIT_LABEL,
  BIO_MAX,
  CORNERS,
  CORNER_LABEL,
  MOOD_MAX,
  NAME_MAX,
  WINDOW_STYLES,
  WINDOW_STYLE_LABEL,
  spaceClass,
  spaceStyle,
  type SpaceModule,
  type SpaceTheme,
} from '@/lib/space';
import { BG_MUSIC_MAX_VOLUME } from '@/lib/pageSettings';
import { saveSpace, type FormState } from '../actions';
import { ModuleList } from './ModuleList';

type Props = {
  username: string;
  profile: { displayName: string; mood: string; bio: string; visibility: 'friends' | 'public' };
  about: unknown;
  modules: SpaceModule[];
  theme: SpaceTheme;
  avatar: { id: string; url: string } | null;
  bg: { id: string; url: string } | null;
};

const COLOR_FIELDS: { key: 'bg' | 'surface' | 'text' | 'accent'; label: string }[] = [
  { key: 'bg', label: 'Fundo da página' },
  { key: 'surface', label: 'Fundo das janelas' },
  { key: 'text', label: 'Texto' },
  { key: 'accent', label: 'Barras de título e links' },
];

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

export function SpaceEditor(props: Props) {
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await saveSpace(prev, form);
    if (result?.ok) setDirty(false);
    return result;
  }, undefined);
  const [theme, setTheme] = useState<SpaceTheme>(props.theme);
  const [modules, setModules] = useState<SpaceModule[]>(props.modules);
  const [about, setAbout] = useState<unknown>(props.about ?? EMPTY_DOC);
  const [avatar, setAvatar] = useState(props.avatar);
  const [bg, setBg] = useState(props.bg);
  const [music, setMusic] = useState(
    props.theme.bgMusic ? `https://www.youtube.com/watch?v=${props.theme.bgMusic.youtubeId}` : '',
  );
  const [picking, setPicking] = useState<'avatar' | 'bg' | null>(null);

  const checks = themeChecks(theme);
  const passes = themePasses(theme);
  const set = <K extends keyof SpaceTheme>(key: K, value: SpaceTheme[K]) => {
    setTheme((t) => ({ ...t, [key]: value }));
    setDirty(true);
  };

  // Aviso ao sair com alterações não salvas
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const choose = async (kind: 'avatar' | 'bg', ids: string[]) => {
    const id = ids[ids.length - 1];
    setPicking(null);
    setDirty(true);
    if (!id) {
      if (kind === 'avatar') setAvatar(null);
      else setBg(null);
      return;
    }
    const urls = await signedUrls(createClient(), [id]);
    const value = { id, url: urls[id] ?? '' };
    if (kind === 'avatar') setAvatar(value);
    else setBg(value);
  };

  const submit = (form: FormData) => {
    form.set('theme', JSON.stringify(theme));
    form.set('modules', JSON.stringify(modules));
    form.set('about', JSON.stringify(about));
    form.set('avatar', avatar?.id ?? '');
    form.set('bg', bg?.id ?? '');
    form.set('bgMusic', music);
    formAction(form);
  };

  return (
    <form action={submit} className="stack" onChange={() => setDirty(true)}>
      <Window title="Editar meu espaço" icon="user" headingLevel={1}>
        <div className="stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Link href="/meu-espaco">← Voltar para Meu espaço</Link>
            <Link href={`/u/${props.username}`}>Ver como fica</Link>
          </div>

          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '1 1 240px' }}>
              <label htmlFor="displayName">Nome de exibição</label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                maxLength={NAME_MAX}
                defaultValue={props.profile.displayName}
                placeholder={`@${props.username}`}
              />
            </div>
            <div className="field" style={{ flex: '0 1 220px' }}>
              <label htmlFor="profileVisibility">Quem pode abrir meu espaço</label>
              <select id="profileVisibility" name="profileVisibility" defaultValue={props.profile.visibility}>
                <option value="friends">Só amigos</option>
                <option value="public">Qualquer pessoa com conta</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="mood">Humor de hoje</label>
            <input
              id="mood"
              name="mood"
              type="text"
              maxLength={MOOD_MAX}
              defaultValue={props.profile.mood}
              placeholder="ouvindo chuva, lendo, cansado…"
            />
          </div>
          <div className="field">
            <label htmlFor="bio">Bio curta</label>
            <textarea id="bio" name="bio" rows={3} maxLength={BIO_MAX} defaultValue={props.profile.bio} />
            <small className="muted">Até {BIO_MAX} caracteres. Aparece no topo do espaço.</small>
          </div>
        </div>
      </Window>

      <Window title="Foto e fundo" icon="image">
        <div className="space-media-pick">
          <div className="stack">
            <p className="space-media-pick__title">Foto do perfil</p>
            <span className="space-avatar space-avatar--lg" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {avatar?.url ? <img src={avatar.url} alt="" /> : <Icon name="user" />}
            </span>
            <div className="row">
              <button type="button" className="btn" onClick={() => setPicking(picking === 'avatar' ? null : 'avatar')}>
                {avatar ? 'Trocar foto' : 'Escolher foto'}
              </button>
              {avatar && (
                <button type="button" className="btn btn--ghost" onClick={() => void choose('avatar', [])}>
                  Remover
                </button>
              )}
            </div>
          </div>
          <div className="stack">
            <p className="space-media-pick__title">Imagem de fundo</p>
            <span className="space-bg-thumb" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {bg?.url && <img src={bg.url} alt="" />}
            </span>
            <div className="row">
              <button type="button" className="btn" onClick={() => setPicking(picking === 'bg' ? null : 'bg')}>
                {bg ? 'Trocar fundo' : 'Escolher fundo'}
              </button>
              {bg && (
                <button type="button" className="btn btn--ghost" onClick={() => void choose('bg', [])}>
                  Remover
                </button>
              )}
            </div>
            {bg && (
              <div className="field">
                <label htmlFor="bgFit">Como mostrar</label>
                <select id="bgFit" value={theme.bgFit} onChange={(e) => set('bgFit', e.target.value as SpaceTheme['bgFit'])}>
                  {BG_FITS.map((f) => (
                    <option key={f} value={f}>
                      {BG_FIT_LABEL[f]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        {picking && (
          <div className="space-picker" role="group" aria-label={picking === 'avatar' ? 'Escolher foto do perfil' : 'Escolher fundo'}>
            <ImagePicker
              selected={[]}
              max={1}
              onChange={(ids) => void choose(picking, ids)}
            />
          </div>
        )}
        <p className="muted" style={{ margin: '12px 0 0', fontSize: '0.875rem' }}>
          Foto e fundo aparecem para todos que podem abrir seu espaço.
        </p>
      </Window>

      <Window title="Sobre mim" icon="pen">
        <RichEditor
          initial={props.about ?? EMPTY_DOC}
          label="Sobre mim"
          onChange={(doc) => {
            setAbout(doc);
            setDirty(true);
          }}
        />
        <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.875rem' }}>
          Quem vê este texto é definido no módulo “Sobre mim”, logo abaixo.
        </p>
      </Window>

      <Window title="Módulos" icon="list">
        <p style={{ marginTop: 0 }}>
          Escolha o que aparece no espaço, para quem e em que ordem. Arraste pela alça{' '}
          <span aria-hidden="true">⠿</span> ou use o teclado.
        </p>
        <ModuleList
          modules={modules}
          onChange={(m) => {
            setModules(m);
            setDirty(true);
          }}
        />
        <p className="muted" style={{ margin: '12px 0 0', fontSize: '0.875rem' }}>
          Wikis, posts, moodboards e playlists continuam respeitando a visibilidade de cada um: um módulo público não
          abre um conteúdo privado.
        </p>
      </Window>

      <Window title="Aparência" icon="star">
        <div className="theme-editor">
          <div className="stack">
            <fieldset className="choice-group">
              <legend>Começar de um tema pronto</legend>
              <div className="preset-row">
                {THEME_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="preset"
                    onClick={() => {
                      setTheme((t) => ({ ...t, ...p.theme }));
                      setDirty(true);
                    }}
                  >
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
              <div className="field" style={{ flex: '1 1 150px' }}>
                <label htmlFor="pattern">Padrão de fundo</label>
                <select
                  id="pattern"
                  value={theme.pattern}
                  onChange={(e) => set('pattern', e.target.value as SpaceTheme['pattern'])}
                  aria-describedby={bg ? 'pattern-help' : undefined}
                >
                  {PATTERNS.map((p) => (
                    <option key={p} value={p}>
                      {PATTERN_LABEL[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: '1 1 150px' }}>
                <label htmlFor="font">Fonte</label>
                <select id="font" value={theme.font} onChange={(e) => set('font', e.target.value as SpaceTheme['font'])}>
                  {FONTS.map((f) => (
                    <option key={f} value={f}>
                      {FONT_LABEL[f]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {bg && (
              <small id="pattern-help" className="muted">
                Com imagem de fundo, o padrão fica escondido atrás dela.
              </small>
            )}

            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: '1 1 150px' }}>
                <label htmlFor="window">Estilo das janelas</label>
                <select id="window" value={theme.window} onChange={(e) => set('window', e.target.value as SpaceTheme['window'])}>
                  {WINDOW_STYLES.map((w) => (
                    <option key={w} value={w}>
                      {WINDOW_STYLE_LABEL[w]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: '1 1 150px' }}>
                <label htmlFor="corners">Cantos</label>
                <select id="corners" value={theme.corners} onChange={(e) => set('corners', e.target.value as SpaceTheme['corners'])}>
                  {CORNERS.map((c) => (
                    <option key={c} value={c}>
                      {CORNER_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <fieldset className="choice-group">
              <legend>Música de fundo</legend>
              <div className="row" style={{ alignItems: 'flex-end' }}>
                <div className="field" style={{ flex: '1 1 260px' }}>
                  <label htmlFor="bgMusicInput">Link do YouTube (vazio = sem música)</label>
                  <input
                    id="bgMusicInput"
                    type="text"
                    inputMode="url"
                    value={music}
                    onChange={(e) => setMusic(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=…"
                    aria-describedby="bgMusic-help"
                  />
                </div>
                {music && (
                  <button type="button" className="btn btn--ghost" onClick={() => {
                    setMusic('');
                    setDirty(true);
                  }}>
                    Remover música
                  </button>
                )}
              </div>
              <small id="bgMusic-help" className="muted">
                {props.theme.bgMusic ? `Atual: ${props.theme.bgMusic.title}. ` : ''}Não toca sozinha: o visitante escolhe
                tocar. Volume limitado a {BG_MUSIC_MAX_VOLUME}% do dispositivo.
              </small>
            </fieldset>

            <div className="contrast-report" role="status" aria-live="polite">
              <p className="contrast-report__title">Verificação de contraste (recomendação)</p>
              <ul>
                {checks.map((c) => {
                  const level = contrastLevel(c.ratio);
                  return (
                    <li key={c.label} className={level === 'insuficiente' ? 'is-bad' : 'is-ok'}>
                      <span>{c.label.replace('do conteúdo', 'das janelas')}</span>
                      <strong>
                        {c.ratio.toFixed(1).replace('.', ',')}:1 · {level === 'insuficiente' ? 'abaixo do recomendado' : level}
                      </strong>
                    </li>
                  );
                })}
              </ul>
              {!passes && (
                <p style={{ margin: 0 }}>
                  Recomendação: pelo menos 4,5:1. Você pode salvar mesmo assim; quem precisar pode ativar o Modo leitura.
                </p>
              )}
            </div>
          </div>

          <div>
            <p className="muted" style={{ margin: '0 0 6px', fontSize: '0.875rem' }}>
              Prévia
            </p>
            <div className={`${spaceClass(theme, Boolean(bg?.url))} wiki-preview space--preview`} style={spaceStyle(theme, bg?.url)}>
              <div className="space-box">
                <div className="space-box__title">
                  <span>Sobre mim</span>
                </div>
                <div className="space-box__body">
                  <p style={{ margin: '0 0 8px' }}>
                    Um texto de exemplo com um <a href="#previa">link destacado</a>.
                  </p>
                  <p className="space-muted" style={{ margin: 0 }}>
                    Humor: {props.profile.mood || 'tranquilo'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Window>

      <div className="save-bar">
        <Notice error={state?.error} ok={state?.ok} />
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar espaço'}
        </button>
      </div>
    </form>
  );
}
