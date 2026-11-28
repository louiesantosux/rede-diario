import type { CSSProperties } from 'react';
import { contrastRatio } from './contrast';
import { isYouTubeId } from './youtube';
import { DEFAULT_THEME, FONTS, PATTERNS, sanitizeTheme, themeStyle, type WikiTheme } from './wikiTheme';

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

export const WINDOW_STYLES = ['aero', 'solida', 'papel', 'classico', 'neon', 'adesivo', 'vidro-escuro', 'aparelho', 'cromado'] as const;
export const ORNAMENTS = ['nenhum', 'estrelas', 'brilhos', 'coracoes', 'caveiras', 'notas'] as const;
export const CORNERS = ['retos', 'suaves', 'redondos'] as const;
export const BG_FITS = ['cobrir', 'repetir'] as const;

export const WINDOW_STYLE_LABEL: Record<(typeof WINDOW_STYLES)[number], string> = {
  aero: 'Vidro (Aero)',
  solida: 'Sólida',
  papel: 'Papel',
  classico: 'Clássico 2006 (sombra dura)',
  neon: 'Neon (borda dupla brilhante)',
  adesivo: 'Adesivo (contorno fino)',
  'vidro-escuro': 'Vidro escuro',
  aparelho: 'Aparelho retrô (visor LCD)',
  cromado: 'Cromado (skin XP)',
};
export const ORNAMENT_LABEL: Record<(typeof ORNAMENTS)[number], string> = {
  nenhum: 'Nenhum',
  estrelas: 'Estrelas ★',
  brilhos: 'Brilhos ✦',
  coracoes: 'Corações ♡',
  caveiras: 'Caveiras ☠',
  notas: 'Notas musicais ♫',
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

/** Fundos prontos (ilustrações próprias do site, em /public/fundos). */
export const BACKDROPS: { id: string; label: string }[] = [
  { id: 'ceu-aero', label: 'Céu Aero' },
  { id: 'scene-queen', label: 'Oncinha roxa' },
  { id: 'emo-rosa', label: 'Zebra rosa' },
  { id: 'vermelho-gotico', label: 'Névoa vermelha' },
  { id: 'adesivo-pb', label: 'Xadrez em perspectiva' },
  { id: 'vampiro-azul', label: 'Floresta à noite' },
  { id: 'sinal-suave', label: 'Circuito' },
  { id: 'galaxia-glitter', label: 'Galáxia neon' },
  { id: 'janela-7', label: 'Azul Windows 7' },
  { id: 'oncinha-pink', label: 'Oncinha com glitter' },
  { id: 'skin-cromado', label: 'Metal lilás' },
  { id: 'papel-de-carta', label: 'Papel florido' },
];
export const backdropUrl = (id: string) => `/fundos/${id}.svg`;
const isBackdrop = (v: unknown): v is string => typeof v === 'string' && BACKDROPS.some((b) => b.id === v);

export type SpaceTheme = WikiTheme & {
  /** Fundo pronto do tema. Uma imagem enviada pela pessoa tem prioridade. */
  backdrop: string | null;
  window: (typeof WINDOW_STYLES)[number];
  /** Cor do padrão de fundo (oncinha, zebra, xadrez…). Vazio: um tom do texto. */
  patternColor: string | null;
  /** Cor dos links dentro das janelas. Vazio: a cor de destaque. */
  linkColor: string | null;
  ornament: (typeof ORNAMENTS)[number];
  corners: (typeof CORNERS)[number];
  bgFit: (typeof BG_FITS)[number];
  /** Opacidade da imagem de fundo sobre preto (#000000), de 10 a 100. */
  bgOpacity: number;
  bgMusic: { youtubeId: string; title: string } | null;
};

export const DEFAULT_SPACE_THEME: SpaceTheme = {
  ...DEFAULT_THEME,
  window: 'aero',
  backdrop: null,
  patternColor: null,
  linkColor: null,
  ornament: 'nenhum',
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
    backdrop: isBackdrop(r.backdrop) ? r.backdrop : null,
    patternColor: typeof r.patternColor === 'string' && /^#[0-9a-f]{6}$/i.test(r.patternColor) ? r.patternColor.toLowerCase() : null,
    linkColor: typeof r.linkColor === 'string' && /^#[0-9a-f]{6}$/i.test(r.linkColor) ? r.linkColor.toLowerCase() : null,
    ornament: pick(r.ornament, ORNAMENTS, DEFAULT_SPACE_THEME.ornament),
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
    ...(t.patternColor ? { '--w-pat': t.patternColor } : {}),
    ...(t.linkColor ? { '--w-link': t.linkColor } : {}),
    ...(bgUrl
      ? { '--space-bg-img': bgLayers(bgUrl, t.bgOpacity) }
      : t.backdrop
        ? { '--space-bg-img': bgLayers(backdropUrl(t.backdrop), t.bgOpacity) }
        : {}),
  } as CSSProperties;
}

/** Imagem sobre fundo preto: uma camada preta translúcida por cima faz o papel da opacidade. */
export function bgLayers(url: string, opacity: number) {
  const shade = (1 - clampOpacity(opacity) / 100).toFixed(2);
  return `linear-gradient(rgba(0, 0, 0, ${shade}), rgba(0, 0, 0, ${shade})), url("${url.replace(/["\\]/g, '')}")`;
}

/** hasUserBg: a pessoa enviou uma imagem de fundo (senão vale o fundo pronto do tema, se houver). */
export function spaceClass(t: SpaceTheme, hasUserBg: boolean) {
  const hasBg = hasUserBg || Boolean(t.backdrop);
  const fit = hasUserBg ? t.bgFit : 'cobrir';
  return [
    'space',
    'wiki-surface',
    `wiki-pattern--${t.pattern}`,
    `wiki-font--${t.font}`,
    `space--${t.window}`,
    t.ornament !== 'nenhum' ? 'space--enfeites' : '',
    hasBg ? `space--img space--img-${fit}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/* ------------------------------------------------------------------ */
/* Temas prontos (inspirados em perfis dos anos 2000 e skins de sistema) */
/* ------------------------------------------------------------------ */

export type ThemeLook = Omit<SpaceTheme, 'bgFit' | 'bgOpacity' | 'bgMusic'>;
export type SpaceThemePreset = { id: string; label: string; hint: string; theme: ThemeLook };

export const SPACE_THEMES: SpaceThemePreset[] = [
  {
    id: 'ceu-aero',
    label: 'Céu Aero',
    hint: 'O padrão do site: Windows 7, vidro e céu.',
    theme: { backdrop: 'ceu-aero', ...DEFAULT_THEME, patternColor: null, linkColor: null, window: 'aero', ornament: 'nenhum', corners: 'suaves' },
  },
  {
    id: 'scene-queen',
    label: 'Scene Queen',
    hint: 'Roxo com oncinha, caixas roxas e títulos pretos.',
    theme: { backdrop: 'scene-queen', bg: '#9d7bf0', surface: '#6a35c2', text: '#ffffff', accent: '#14101f', linkColor: '#ffe36e', pattern: 'oncinha', patternColor: '#5b3ba8', font: 'verdana', window: 'classico', ornament: 'caveiras', corners: 'retos' },
  },
  {
    id: 'emo-rosa',
    label: 'Emo rosa',
    hint: 'Preto com zebra rosa e caixas rosa-choque.',
    theme: { backdrop: 'emo-rosa', bg: '#0c0c0c', surface: '#ff6cb8', text: '#1a0010', accent: '#0c0c0c', linkColor: '#3d0024', pattern: 'zebra', patternColor: '#ff2e93', font: 'verdana', window: 'classico', ornament: 'estrelas', corners: 'retos' },
  },
  {
    id: 'vermelho-gotico',
    label: 'Vermelho gótico',
    hint: 'Tudo preto, títulos vermelhos e brilho difuso.',
    theme: { backdrop: 'vermelho-gotico', bg: '#000000', surface: '#0b0000', text: '#f5d6d6', accent: '#c40000', linkColor: '#ff6b6b', pattern: 'nenhum', patternColor: null, font: 'sistema', window: 'neon', ornament: 'nenhum', corners: 'retos' },
  },
  {
    id: 'adesivo-pb',
    label: 'Adesivo P&B',
    hint: 'Preto e branco, xadrez grande e contornos finos.',
    theme: { backdrop: 'adesivo-pb', bg: '#141414', surface: '#000000', text: '#f2f2f2', accent: '#f2f2f2', linkColor: null, pattern: 'xadrez-grande', patternColor: '#2c2c2c', font: 'pixel', window: 'adesivo', ornament: 'estrelas', corners: 'retos' },
  },
  {
    id: 'vampiro-azul',
    label: 'Vampiro azul',
    hint: 'Floresta noturna, vidro escuro e estrelas.',
    theme: { backdrop: 'vampiro-azul', bg: '#0b1b22', surface: '#12303b', text: '#d3e9f0', accent: '#8cc4d6', linkColor: null, pattern: 'estrelas', patternColor: null, font: 'sistema', window: 'vidro-escuro', ornament: 'estrelas', corners: 'suaves' },
  },
  {
    id: 'sinal-suave',
    label: 'Sinal suave',
    hint: 'Aparelho bege com visor verde e detalhes rosa.',
    theme: { backdrop: 'sinal-suave', bg: '#1c2220', surface: '#e8e4cf', text: '#263020', accent: '#7aa62e', linkColor: '#a3245f', pattern: 'grade', patternColor: '#2c3631', font: 'pixel', window: 'aparelho', ornament: 'nenhum', corners: 'redondos' },
  },
  {
    id: 'galaxia-glitter',
    label: 'Galáxia glitter',
    hint: 'Preto com grade rosa, borda dupla neon e estrelas.',
    theme: { backdrop: 'galaxia-glitter', bg: '#050005', surface: '#000000', text: '#ffffff', accent: '#ff3fb4', linkColor: null, pattern: 'grade', patternColor: '#4a0a36', font: 'pixel', window: 'neon', ornament: 'estrelas', corners: 'retos' },
  },
  {
    id: 'janela-7',
    label: 'Janela 7',
    hint: 'Página branca de navegador antigo sobre o azul do Windows 7.',
    theme: { backdrop: 'janela-7', bg: '#2f86d8', surface: '#ffffff', text: '#222222', accent: '#4f9fae', linkColor: '#1d6fa5', pattern: 'feixes', patternColor: null, font: 'sistema', window: 'aero', ornament: 'brilhos', corners: 'suaves' },
  },
  {
    id: 'oncinha-pink',
    label: 'Oncinha pink',
    hint: 'Rosa-choque com oncinha preta e caixas pretas.',
    theme: { backdrop: 'oncinha-pink', bg: '#ff2b9c', surface: '#0b0b0b', text: '#ffd3ec', accent: '#ff47b0', linkColor: null, pattern: 'oncinha', patternColor: '#0b0b0b', font: 'verdana', window: 'solida', ornament: 'coracoes', corners: 'suaves' },
  },
  {
    id: 'skin-cromado',
    label: 'Skin cromado',
    hint: 'Metal lilás de skin de XP, janelas com bisel.',
    theme: { backdrop: 'skin-cromado', bg: '#8a90b4', surface: '#e7e9f3', text: '#1d2135', accent: '#3d4466', linkColor: null, pattern: 'bolhas', patternColor: '#a9aed0', font: 'sistema', window: 'cromado', ornament: 'nenhum', corners: 'suaves' },
  },
  {
    id: 'papel-de-carta',
    label: 'Papel de carta',
    hint: 'Bege com listras, serifa e janelas de papel.',
    theme: { backdrop: 'papel-de-carta', bg: '#efe2c6', surface: '#fbf6ea', text: '#2a2318', accent: '#7a2e12', linkColor: null, pattern: 'listras', patternColor: null, font: 'serifa', window: 'papel', ornament: 'notas', corners: 'suaves' },
  },
];

/** Posições fixas dos enfeites (em % da área), com tamanho e rotação. */
export const ORNAMENT_SPOTS = [
  { top: 3, left: 3, size: 3.6, rot: -12 },
  { top: 8, left: 92, size: 2.4, rot: 10 },
  { top: 30, left: 96, size: 1.6, rot: 0 },
  { top: 44, left: 1, size: 2.2, rot: 18 },
  { top: 62, left: 95, size: 3.4, rot: -8 },
  { top: 78, left: 4, size: 1.8, rot: 6 },
  { top: 90, left: 88, size: 2.2, rot: 14 },
  { top: 96, left: 40, size: 1.4, rot: 0 },
];

export const ORNAMENT_GLYPHS: Record<Exclude<(typeof ORNAMENTS)[number], 'nenhum'>, string[]> = {
  estrelas: ['★', '☆', '✩', '★'],
  brilhos: ['✦', '✧', '✦', '⋆'],
  coracoes: ['♥', '♡', '❥', '♡'],
  caveiras: ['☠', '✝', '☠', '✟'],
  notas: ['♪', '♫', '♬', '♩'],
};

/** Verificação de contraste do espaço (recomendação): texto e links sobre as janelas, título sobre a barra. */
export function spaceChecks(t: SpaceTheme) {
  const onAccent = contrastRatio('#ffffff', t.accent) >= contrastRatio('#111111', t.accent) ? '#ffffff' : '#111111';
  return [
    { label: 'Texto sobre o fundo das janelas', ratio: contrastRatio(t.text, t.surface) },
    { label: 'Links sobre o fundo das janelas', ratio: contrastRatio(t.linkColor ?? t.accent, t.surface) },
    { label: 'Título sobre a barra de título', ratio: contrastRatio(onAccent, t.accent) },
  ];
}

export const BIO_MAX = 300;
export const NAME_MAX = 50;
export const MOOD_MAX = 80;
export const NOTE_MAX = 500;

/* ------------------------------------------------------------------ */
/* Gerar aleatoriamente                                                */
/* ------------------------------------------------------------------ */

function hslHex(h: number, s: number, l: number) {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(Math.min(1, Math.max(0, c)) * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Ajusta a luminosidade até atingir o contraste mínimo com o fundo. */
function withContrast(h: number, s: number, l: number, against: string, darker: boolean, min = 4.5) {
  let light = l;
  let color = hslHex(h, s, light);
  for (let i = 0; i < 40 && contrastRatio(color, against) < min; i++) {
    light = Math.min(0.98, Math.max(0.02, light + (darker ? -0.025 : 0.025)));
    color = hslHex(h, s, light);
  }
  return color;
}

/**
 * Combinação aleatória, mas harmoniosa: uma cor base, uma cor de destaque em
 * relação clássica (complementar, análoga, tríade…), e texto e links sempre
 * com contraste de pelo menos 4,5:1. Sem IA: só sorteio com regras de cor.
 */
export function randomSpaceTheme(rand: () => number = Math.random): ThemeLook {
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const h = rand() * 360;
  const dark = rand() < 0.5;
  const accentHue = (h + pick([0, 30, 150, 180, 210, 330])) % 360;

  const bg = dark ? hslHex(h, 0.35 + rand() * 0.45, 0.05 + rand() * 0.12) : hslHex(h, 0.4 + rand() * 0.5, 0.72 + rand() * 0.16);
  const surface = dark ? hslHex(h, 0.2 + rand() * 0.35, 0.08 + rand() * 0.12) : hslHex(h, 0.3 + rand() * 0.5, 0.92 + rand() * 0.06);
  const text = withContrast(h, 0.25, dark ? 0.88 : 0.15, surface, !dark, 7);
  const accent = withContrast(accentHue, 0.65 + rand() * 0.3, dark ? 0.62 : 0.4, surface, !dark);
  const pattern = pick(PATTERNS.filter((p) => p !== 'feixes'));
  const backdropChance = rand();

  return {
    bg,
    surface,
    text,
    accent,
    linkColor: null,
    pattern,
    patternColor: rand() < 0.6 ? hslHex(pick([h, accentHue]), 0.5 + rand() * 0.4, dark ? 0.22 + rand() * 0.15 : 0.55 + rand() * 0.2) : null,
    font: pick(FONTS),
    window: pick(WINDOW_STYLES),
    ornament: rand() < 0.35 ? 'nenhum' : pick(ORNAMENTS.filter((o) => o !== 'nenhum')),
    corners: pick(CORNERS),
    backdrop: backdropChance < 0.35 ? pick(BACKDROPS).id : null,
  };
}

/* ------------------------------------------------------------------ */
/* Sincronizar com a aparência do site                                 */
/* ------------------------------------------------------------------ */

const SPACE_TO_UI_FONT: Record<SpaceTheme['font'], 'padrao' | 'serifa' | 'arredondada' | 'retro' | 'maquina' | 'pixel'> = {
  sistema: 'padrao',
  serifa: 'serifa',
  arredondada: 'arredondada',
  maquina: 'maquina',
  verdana: 'retro',
  pixel: 'pixel',
};

/**
 * Converte o tema do espaço na aparência do site: tema base claro ou escuro
 * conforme o fundo, destaque legível sobre as janelas do site, papel de parede,
 * fundo pronto, fonte e cantos.
 */
export function siteFromSpace(t: SpaceTheme) {
  const dark = contrastRatio(t.bg, '#000000') < contrastRatio(t.bg, '#ffffff');
  const siteSurface = dark ? '#13212f' : '#fbfdff';
  const candidates = [t.accent, t.linkColor, t.text].filter((c): c is string => Boolean(c));
  const accent = candidates.reduce((best, c) => (contrastRatio(c, siteSurface) > contrastRatio(best, siteSurface) && contrastRatio(best, siteSurface) < 3 ? c : best), candidates[0]);
  return {
    base: (dark ? 'aero-escuro' : 'aero-claro') as 'aero-escuro' | 'aero-claro',
    ui: {
      accent,
      wallpaper: t.bg,
      backdrop: t.backdrop,
      font: SPACE_TO_UI_FONT[t.font],
      corners: (t.corners === 'suaves' ? 'padrao' : t.corners) as 'padrao' | 'retos' | 'redondos',
      syncSpace: true,
    },
  };
}
