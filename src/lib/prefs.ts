import { UI_PREFS_KEY, applyUiPrefs, reapplyStoredUi } from './uiPrefs';

export type ThemeId = 'auto' | 'aero-claro' | 'aero-escuro' | 'papel' | 'alto-contraste';

export type A11yPrefs = {
  theme: ThemeId;
  fontScale: number; // 0.9 a 2
  lineSpacing: 'normal' | 'amplo';
  font: 'sistema' | 'atkinson';
  reduceMotion: boolean;
  reduceTransparency: boolean;
  readingMode: boolean; // ignora temas criados por outros usuários
};

export const DEFAULT_PREFS: A11yPrefs = {
  theme: 'auto',
  fontScale: 1,
  lineSpacing: 'normal',
  font: 'sistema',
  reduceMotion: false,
  reduceTransparency: false,
  readingMode: false,
};

export const PREFS_KEY = 'a11y-prefs';

export const THEME_OPTIONS: { id: ThemeId; label: string }[] = [
  { id: 'auto', label: 'Automático (segue o sistema)' },
  { id: 'aero-claro', label: 'Aero Claro' },
  { id: 'aero-escuro', label: 'Aero Escuro' },
  { id: 'papel', label: 'Papel' },
  { id: 'alto-contraste', label: 'Alto contraste' },
];

export function applyPrefs(prefs: A11yPrefs) {
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const systemReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.dataset.theme = prefs.theme === 'auto' ? (systemDark ? 'aero-escuro' : 'aero-claro') : prefs.theme;
  root.style.setProperty('--font-scale', String(prefs.fontScale));
  root.dataset.lineSpacing = prefs.lineSpacing;
  root.dataset.font = prefs.font;
  root.dataset.reduceMotion = String(prefs.reduceMotion || systemReduce);
  root.dataset.reduceTransparency = String(prefs.reduceTransparency);
  root.dataset.readingMode = String(prefs.readingMode);
  // A aparência escolhida no Meu espaço depende do tema base (ex.: alto contraste a ignora).
  reapplyStoredUi();
}

// Script executado antes da pintura para evitar "flash" de tema errado.
// Mantém a mesma lógica de applyPrefs, sem depender do bundle.
export const PREFS_BOOT_SCRIPT = `(function(){try{
var d=${JSON.stringify(DEFAULT_PREFS)};
var p=Object.assign({},d,JSON.parse(localStorage.getItem('${PREFS_KEY}')||'{}'));
var r=document.documentElement;
var dark=matchMedia('(prefers-color-scheme: dark)').matches;
var rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
r.dataset.theme=p.theme==='auto'?(dark?'aero-escuro':'aero-claro'):p.theme;
r.style.setProperty('--font-scale',String(p.fontScale));
r.dataset.lineSpacing=p.lineSpacing;r.dataset.font=p.font;
r.dataset.reduceMotion=String(p.reduceMotion||rm);
r.dataset.reduceTransparency=String(p.reduceTransparency);
r.dataset.readingMode=String(p.readingMode);
(${applyUiPrefs.toString()})(JSON.parse(localStorage.getItem('${UI_PREFS_KEY}')||'{}'));
}catch(e){}})();`;
