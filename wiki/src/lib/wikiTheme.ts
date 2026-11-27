import type { CSSProperties } from 'react';
import { HEX_RE, contrastRatio } from './contrast';

export const PATTERNS = ['nenhum', 'pontos', 'xadrez', 'listras', 'estrelas', 'bolhas'] as const;
export const FONTS = ['sistema', 'serifa', 'arredondada', 'maquina'] as const;

export type WikiTheme = {
  bg: string;
  surface: string;
  text: string;
  accent: string;
  pattern: (typeof PATTERNS)[number];
  font: (typeof FONTS)[number];
};

export const PATTERN_LABEL: Record<WikiTheme['pattern'], string> = {
  nenhum: 'Nenhum',
  pontos: 'Pontos',
  xadrez: 'Xadrez',
  listras: 'Listras',
  estrelas: 'Estrelas',
  bolhas: 'Bolhas',
};

export const FONT_LABEL: Record<WikiTheme['font'], string> = {
  sistema: 'Padrão',
  serifa: 'Serifa (livro)',
  arredondada: 'Arredondada (Y2K)',
  maquina: 'Máquina de escrever',
};

export const THEME_PRESETS: { id: string; label: string; theme: WikiTheme }[] = [
  { id: 'ceu', label: 'Céu Aero', theme: { bg: '#cfe3f5', surface: '#fbfdff', text: '#17222d', accent: '#0a4c8c', pattern: 'bolhas', font: 'sistema' } },
  { id: 'papel', label: 'Papel de carta', theme: { bg: '#efe2c6', surface: '#fbf6ea', text: '#2a2318', accent: '#7a2e12', pattern: 'listras', font: 'serifa' } },
  { id: 'noite', label: 'Noite', theme: { bg: '#0d1626', surface: '#162238', text: '#eef2f8', accent: '#9cc9ff', pattern: 'estrelas', font: 'sistema' } },
  { id: 'rosa', label: 'Rosa Y2K', theme: { bg: '#f7d6ec', surface: '#fff6fb', text: '#3a1030', accent: '#8a1460', pattern: 'pontos', font: 'arredondada' } },
  { id: 'menta', label: 'Menta', theme: { bg: '#d4f0e4', surface: '#f6fffa', text: '#10291f', accent: '#0f5a3c', pattern: 'xadrez', font: 'sistema' } },
  { id: 'grafite', label: 'Grafite', theme: { bg: '#2b2f36', surface: '#363b44', text: '#f1f3f6', accent: '#ffd479', pattern: 'nenhum', font: 'maquina' } },
];

export const DEFAULT_THEME: WikiTheme = THEME_PRESETS[0].theme;

const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;
const hex = (v: unknown, fallback: string) => (typeof v === 'string' && HEX_RE.test(v) ? v.toLowerCase() : fallback);

export function sanitizeTheme(raw: unknown): WikiTheme {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    bg: hex(r.bg, DEFAULT_THEME.bg),
    surface: hex(r.surface, DEFAULT_THEME.surface),
    text: hex(r.text, DEFAULT_THEME.text),
    accent: hex(r.accent, DEFAULT_THEME.accent),
    pattern: pick(r.pattern, PATTERNS, DEFAULT_THEME.pattern),
    font: pick(r.font, FONTS, DEFAULT_THEME.font),
  };
}

/** Verificações exigidas pelo PRD: texto e links com contraste mínimo AA (4,5:1). */
export function themeChecks(t: WikiTheme) {
  return [
    { label: 'Texto sobre o fundo do conteúdo', ratio: contrastRatio(t.text, t.surface) },
    { label: 'Links sobre o fundo do conteúdo', ratio: contrastRatio(t.accent, t.surface) },
  ];
}

export const themePasses = (t: WikiTheme) => themeChecks(t).every((c) => c.ratio >= 4.5);

/** Variáveis CSS aplicadas à área personalizada (o "modo leitura" as substitui). */
export function themeStyle(t: WikiTheme): CSSProperties {
  return {
    '--w-bg': t.bg,
    '--w-surface': t.surface,
    '--w-text': t.text,
    '--w-accent': t.accent,
  } as CSSProperties;
}
