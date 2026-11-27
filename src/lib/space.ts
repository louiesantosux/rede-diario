import type { CSSProperties } from 'react';
import { contrastRatio } from './contrast';
import { isYouTubeId } from './youtube';
import { DEFAULT_THEME, sanitizeTheme, themeStyle, type WikiTheme } from './wikiTheme';

/* ------------------------------------------------------------------ */
/* Módulos                                                             */
/* ------------------------------------------------------------------ */

export const MODULE_KEYS = [
  'sobre',
  'posts',
  'missoes',
  'wikis',
  'moodboards',
  'playlists',
  'galeria',
  'amigos',
  'mural',
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_VIS = ['private', 'friends', 'public'] as const;
export type ModuleVis = (typeof MODULE_VIS)[number];

export type SpaceModule = { key: ModuleKey; on: boolean; vis: ModuleVis };

export const MODULE_INFO: Record<ModuleKey, { label: string; hint: string }> = {
  sobre: { label: 'Sobre mim', hint: 'Texto livre com imagens e links.' },
  posts: { label: 'Posts recentes', hint: 'Seus últimos posts, fora das missões.' },
  missoes: { label: 'Missões respondidas', hint: 'Posts feitos a partir das missões do dia.' },
  wikis: { label: 'Wikis', hint: 'Coleções, blogs e diários.' },
  moodboards: { label: 'Moodboards', hint: 'Seus painéis de imagens.' },
  playlists: { label: 'Playlists', hint: 'Suas playlists do YouTube.' },
  galeria: { label: 'Galeria', hint: 'Fotos recentes já visíveis em outros conteúdos.' },
  amigos: { label: 'Amigos', hint: 'Lista em ordem alfabética, sem contagem.' },
  mural: { label: 'Mural de recados', hint: 'Amigos deixam recados; você aprova antes de aparecerem.' },
};

export const MODULE_VIS_LABEL: Record<ModuleVis, string> = {
  private: 'Só eu',
  friends: 'Amigos',
  public: 'Público',
};

export const DEFAULT_MODULES: SpaceModule[] = MODULE_KEYS.map((key) => ({
  key,
  on: key !== 'galeria',
  vis: 'friends',
}));

/** Normaliza a lista: sem repetidos, sem chaves desconhecidas e com todos os módulos presentes. */
export function sanitizeModules(raw: unknown): SpaceModule[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_MODULES.map((m) => ({ ...m }));
  const list: unknown[] = raw;
  const seen = new Set<ModuleKey>();
  const out: SpaceModule[] = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, unknown>;
    const key = r.key as ModuleKey;
    if (!MODULE_KEYS.includes(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      on: r.on === true,
      vis: MODULE_VIS.includes(r.vis as ModuleVis) ? (r.vis as ModuleVis) : 'private',
    });
  }
  for (const m of DEFAULT_MODULES) if (!seen.has(m.key)) out.push({ ...m, on: false });
  return out;
}

/* ------------------------------------------------------------------ */
/* Aparência                                                           */
/* ------------------------------------------------------------------ */

export const WINDOW_STYLES = ['aero', 'solida', 'papel'] as const;
export const CORNERS = ['retos', 'suaves', 'redondos'] as const;
export const BG_FITS = ['cobrir', 'repetir'] as const;

export const WINDOW_STYLE_LABEL: Record<(typeof WINDOW_STYLES)[number], string> = {
  aero: 'Vidro (Aero)',
  solida: 'Sólida',
  papel: 'Papel',
};
export const CORNER_LABEL: Record<(typeof CORNERS)[number], string> = {
  retos: 'Retos',
  suaves: 'Suaves',
  redondos: 'Redondos',
};
export const BG_FIT_LABEL: Record<(typeof BG_FITS)[number], string> = {
  cobrir: 'Cobrir a tela',
  repetir: 'Repetir (mosaico)',
};

export type SpaceTheme = WikiTheme & {
  window: (typeof WINDOW_STYLES)[number];
  corners: (typeof CORNERS)[number];
  bgFit: (typeof BG_FITS)[number];
  /** Opacidade da imagem de fundo sobre preto (#000000), de 10 a 100. */
  bgOpacity: number;
  bgMusic: { youtubeId: string; title: string } | null;
};

export const DEFAULT_SPACE_THEME: SpaceTheme = {
  ...DEFAULT_THEME,
  window: 'aero',
  corners: 'suaves',
  bgFit: 'cobrir',
  bgOpacity: 100,
  bgMusic: null,
};

export const clampOpacity = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(100, Math.max(10, v))) : 100;

const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;

export function sanitizeSpaceTheme(raw: unknown): SpaceTheme {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const m = (typeof r.bgMusic === 'object' && r.bgMusic !== null ? r.bgMusic : null) as Record<string, unknown> | null;
  return {
    ...sanitizeTheme(r),
    window: pick(r.window, WINDOW_STYLES, DEFAULT_SPACE_THEME.window),
    corners: pick(r.corners, CORNERS, DEFAULT_SPACE_THEME.corners),
    bgFit: pick(r.bgFit, BG_FITS, DEFAULT_SPACE_THEME.bgFit),
    bgOpacity: clampOpacity(r.bgOpacity),
    bgMusic:
      m && isYouTubeId(m.youtubeId)
        ? { youtubeId: m.youtubeId, title: typeof m.title === 'string' ? m.title.slice(0, 200) : 'Música de fundo' }
        : null,
  };
}

const RADIUS: Record<SpaceTheme['corners'], string> = { retos: '0px', suaves: '8px', redondos: '18px' };

/** Variáveis CSS do espaço. A cor do texto da barra de título é escolhida pelo maior contraste. */
export function spaceStyle(t: SpaceTheme, bgUrl?: string | null): CSSProperties {
  const onAccent = contrastRatio('#ffffff', t.accent) >= contrastRatio('#111111', t.accent) ? '#ffffff' : '#111111';
  return {
    ...themeStyle(t),
    '--w-on-accent': onAccent,
    '--w-radius': RADIUS[t.corners],
    ...(bgUrl ? { '--space-bg-img': bgLayers(bgUrl, t.bgOpacity) } : {}),
  } as CSSProperties;
}

/** Imagem sobre fundo preto: uma camada preta translúcida por cima faz o papel da opacidade. */
export function bgLayers(url: string, opacity: number) {
  const shade = (1 - clampOpacity(opacity) / 100).toFixed(2);
  return `linear-gradient(rgba(0, 0, 0, ${shade}), rgba(0, 0, 0, ${shade})), url("${url.replace(/["\\]/g, '')}")`;
}

export function spaceClass(t: SpaceTheme, hasBg: boolean) {
  return [
    'space',
    'wiki-surface',
    `wiki-pattern--${t.pattern}`,
    `wiki-font--${t.font}`,
    `space--${t.window}`,
    hasBg ? `space--img space--img-${t.bgFit}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export const BIO_MAX = 300;
export const NAME_MAX = 50;
export const MOOD_MAX = 80;
export const NOTE_MAX = 500;
