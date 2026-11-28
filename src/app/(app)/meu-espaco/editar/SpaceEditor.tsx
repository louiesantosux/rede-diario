'use client';

import { useActionState, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Window } from '@/components/Window';
import { Notice } from '@/components/Notice';
import { ColorPicker } from '@/components/ColorPicker';
import { Icon } from '@/components/Icon';
import { RichEditor } from '@/components/editor/RichEditor';
import { ImagePicker } from '@/components/wiki/ImagePicker';
import { createClient } from '@/lib/supabase/client';
import { signedUrls } from '@/lib/mediaClient';
import { contrastLevel } from '@/lib/contrast';
import { FONTS, FONT_LABEL, PATTERNS, PATTERN_LABEL } from '@/lib/wikiTheme';
import { SpaceOrnaments } from '@/components/space/SpaceOrnaments';
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
import { saveSpace, saveSpaceMedia, type FormState, type SpaceMediaInput } from '../actions';
import { BACKDROPS, ORNAMENTS, ORNAMENT_LABEL, SPACE_THEMES, backdropUrl, bgLayers, spaceChecks } from '@/lib/space';
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

  const checks = spaceChecks(theme);
  const passes = checks.every((c) => c.ratio >= 4.5);
  const activePreset = SPACE_THEMES.find((p) =>
    (Object.keys(p.theme) as (keyof typeof p.theme)[]).every((k) => p.theme[k] === theme[k]),
  )?.id;
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

  // Foto e fundo são salvos na hora em que são escolhidos.
  const [mediaStatus, setMediaStatus] = useState('');
  const persistMedia = async (input: SpaceMediaInput, done: string) => {
    setMediaStatus('Salvando…');
    const res = await saveSpaceMedia(input);
    setMediaStatus(res.ok ? done : res.error ?? 'Não foi possível salvar.');
  };

  const choose = async (kind: 'avatar' | 'bg', ids: string[]) => {
    const id = ids[ids.length - 1] ?? null;
    setPicking(null);
    if (!id) {
      if (kind === 'avatar') setAvatar(null);
      else setBg(null);
    } else {
      const urls = await signedUrls(createClient(), [id]);
      const value = { id, url: urls[id] ?? '' };
      if (kind === 'avatar') setAvatar(value);
      else setBg(value);
    }
    const label = kind === 'avatar' ? 'Foto do perfil' : 'Fundo';
    void persistMedia(kind === 'avatar' ? { avatar: id } : { bg: id }, id ? `${label} salvo.` : `${label} removido.`);
  };

  // Ajustes do fundo: aplica na hora e salva meio segundo depois da última mudança.
  const bgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setBgOption = (patch: Partial<Pick<SpaceTheme, 'bgFit' | 'bgOpacity'>>) => {
    setTheme((t) => ({ ...t, ...patch }));
    if (bgTimer.current) clearTimeout(bgTimer.current);
    bgTimer.current = setTimeout(() => void persistMedia(patch, 'Ajuste do fundo salvo.'), 500);
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

          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '1 1 200px' }}>
              <label htmlFor="username">Seu @</label>
              <div className="input-prefix">
                <span aria-hidden="true">@</span>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  minLength={3}
                  maxLength={24}
                  pattern="[a-z0-9_.]{3,24}"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  defaultValue={props.username}
                  aria-describedby="username-help"
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.value = el.value.toLowerCase().replace(/^@/, '');
                  }}
                />
              </div>
              <small id="username-help" className="muted">
                3 a 24 caracteres: letras minúsculas sem acento, números, ponto ou sublinhado. Links antigos para o
                seu espaço deixam de funcionar.
              </small>
            </div>
            <div className="field" style={{ flex: '1 1 220px' }}>
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
            {bg?.url || theme.backdrop ? (
              <div
                className={`space-bg-preview${bg?.url && theme.bgFit === 'repetir' ? ' space-bg-preview--repetir' : ''}`}
                style={
                  {
                    '--space-bg-img': bgLayers(bg?.url || backdropUrl(theme.backdrop as string), theme.bgOpacity),
                  } as CSSProperties
                }
                role="img"
                aria-label={`Prévia do fundo com ${theme.bgOpacity}% de opacidade sobre preto`}
              >
                <span className="space-bg-preview__card" aria-hidden="true">
                  Prévia do fundo
                </span>
              </div>
            ) : (
              <span className="space-bg-thumb" aria-hidden="true" />
            )}
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
            <fieldset className="choice-group">
              <legend>Fundos prontos</legend>
              <div className="backdrop-row">
                <button
                  type="button"
                  className="backdrop-chip backdrop-chip--none"
                  aria-pressed={!bg && !theme.backdrop}
                  onClick={() => {
                    setTheme((t) => ({ ...t, backdrop: null }));
                    void persistMedia({ backdrop: null }, 'Sem fundo pronto: vale a cor e o padrão.');
                  }}
                >
                  Nenhum
                </button>
                {BACKDROPS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="backdrop-chip"
                    aria-pressed={!bg && theme.backdrop === b.id}
                    title={b.label}
                    onClick={() => {
                      setTheme((t) => ({ ...t, backdrop: b.id }));
                      setBg(null);
                      void persistMedia({ backdrop: b.id, bg: null }, `Fundo “${b.label}” salvo.`);
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={backdropUrl(b.id)} alt="" loading="lazy" />
                    <span className="sr-only">{b.label}</span>
                  </button>
                ))}
              </div>
              <small className="muted">Uma imagem enviada por você tem prioridade sobre o fundo pronto.</small>
            </fieldset>
            {(bg || theme.backdrop) && (
              <>
                <div className="field">
                  <label htmlFor="bgOpacity">
                    Opacidade da imagem: {theme.bgOpacity}%
                  </label>
                  <input
                    id="bgOpacity"
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={theme.bgOpacity}
                    onChange={(e) => setBgOption({ bgOpacity: Number(e.target.value) })}
                    aria-describedby="bgOpacity-help"
                  />
                  <small id="bgOpacity-help" className="muted">
                    O fundo por trás da imagem é preto (#000000): quanto menor a opacidade, mais escura ela fica.
                  </small>
                </div>
                {bg && (
                <div className="field">
                  <label htmlFor="bgFit">Como mostrar</label>
                  <select
                    id="bgFit"
                    value={theme.bgFit}
                    onChange={(e) => setBgOption({ bgFit: e.target.value as SpaceTheme['bgFit'] })}
                  >
                    {BG_FITS.map((f) => (
                      <option key={f} value={f}>
                        {BG_FIT_LABEL[f]}
                      </option>
                    ))}
                  </select>
                </div>
                )}
              </>
            )}
          </div>
        </div>
        {picking && (
          <div className="space-picker" role="group" aria-label={picking === 'avatar' ? 'Escolher foto do perfil' : 'Escolher fundo'}>
            <ImagePicker selected={[]} max={1} onChange={(ids) => void choose(picking, ids)} />
          </div>
        )}
        <p className="autosave" role="status" aria-live="polite">
          {mediaStatus || 'Foto e fundo são salvos assim que você escolhe. Aparecem para todos que podem abrir seu espaço.'}
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
              <legend>Temas prontos</legend>
              <ul className="theme-gallery">
                {SPACE_THEMES.map((p) => {
                  const look = { ...theme, ...p.theme };
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="theme-card"
                        aria-pressed={activePreset === p.id}
                        onClick={() => {
                          setTheme((t) => ({ ...t, ...p.theme }));
                          // O tema traz o próprio fundo: a imagem enviada sai (volta a valer ao escolhê-la de novo).
                          if (bg) {
                            setBg(null);
                            setMediaStatus('O fundo do tema substituiu sua imagem de fundo. Salve o espaço para confirmar.');
                          }
                          setDirty(true);
                        }}
                      >
                        <span className={`${spaceClass(look, false)} wiki-preview theme-card__preview`} style={spaceStyle(look)} aria-hidden="true">
                          <SpaceOrnaments ornament={look.ornament} scale={0.45} />
                          <span className="space-box">
                            <span className="space-box__title">
                              <span>sobre mim</span>
                            </span>
                            <span className="space-box__body" style={{ display: 'block' }}>
                              oi! <span className="theme-card__link">link</span>
                            </span>
                          </span>
                        </span>
                        <span className="theme-card__name">{p.label}</span>
                        <span className="theme-card__hint">{p.hint}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <small className="muted">
                O tema troca cores, padrão, fonte, janelas, cantos e enfeites. Foto, fundo e música continuam. Depois dá
                para ajustar tudo abaixo.
              </small>
            </fieldset>

            <fieldset className="choice-group">
              <legend>Cores</legend>
              <div className="color-grid">
                {COLOR_FIELDS.map((f) => (
                  <ColorPicker key={f.key} label={f.label} value={theme[f.key]} onChange={(hex) => set(f.key, hex)} />
                ))}
                <div className="stack" style={{ gap: 4 }}>
                  <ColorPicker
                    label={theme.linkColor ? 'Links' : 'Links (igual ao destaque)'}
                    value={theme.linkColor ?? theme.accent}
                    onChange={(hex) => set('linkColor', hex)}
                  />
                  {theme.linkColor && (
                    <button type="button" className="btn btn--ghost" onClick={() => set('linkColor', null)}>
                      Usar a cor de destaque
                    </button>
                  )}
                </div>
                <div className="stack" style={{ gap: 4 }}>
                  <ColorPicker
                    label={theme.patternColor ? 'Padrão e enfeites' : 'Padrão e enfeites (automático)'}
                    value={theme.patternColor ?? theme.accent}
                    onChange={(hex) => set('patternColor', hex)}
                  />
                  {theme.patternColor && (
                    <button type="button" className="btn btn--ghost" onClick={() => set('patternColor', null)}>
                      Voltar ao automático
                    </button>
                  )}
                </div>
              </div>
            </fieldset>

            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: '1 1 150px' }}>
                <label htmlFor="pattern">Padrão de fundo</label>
                <select
                  id="pattern"
                  value={theme.pattern}
                  onChange={(e) => set('pattern', e.target.value as SpaceTheme['pattern'])}
                  aria-describedby={bg || theme.backdrop ? 'pattern-help' : undefined}
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
            {(bg || theme.backdrop) && (
              <small id="pattern-help" className="muted">
                Com imagem de fundo (sua ou do tema), o padrão fica escondido atrás dela.
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
                <label htmlFor="ornament">Enfeites</label>
                <select
                  id="ornament"
                  value={theme.ornament}
                  onChange={(e) => set('ornament', e.target.value as SpaceTheme['ornament'])}
                >
                  {ORNAMENTS.map((o) => (
                    <option key={o} value={o}>
                      {ORNAMENT_LABEL[o]}
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
              <SpaceOrnaments ornament={theme.ornament} scale={0.7} />
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
