// Aparência da interface escolhida pela pessoa (Meu espaço → Aparência do site).
// Fica salva em profiles.theme e no navegador (para aplicar antes da pintura).
// Os recursos de acessibilidade têm prioridade: com "Alto contraste" as cores
// não são trocadas, e com a fonte Atkinson a fonte escolhida aqui é ignorada.

export type UiFont = 'padrao' | 'serifa' | 'arredondada' | 'retro' | 'maquina';
export type UiCorners = 'padrao' | 'retos' | 'redondos';

export type UiPrefs = {
  accent: string | null;
  wallpaper: string | null;
  font: UiFont;
  corners: UiCorners;
};

export const UI_PREFS_KEY = 'ui-prefs';
export const DEFAULT_UI: UiPrefs = { accent: null, wallpaper: null, font: 'padrao', corners: 'padrao' };

export const UI_FONTS: { id: UiFont; label: string; stack: string }[] = [
  { id: 'padrao', label: 'Padrão (Segoe, Windows 7)', stack: '' },
  { id: 'serifa', label: 'Serifa (livro)', stack: "Georgia, 'Times New Roman', serif" },
  { id: 'arredondada', label: 'Arredondada (Y2K)', stack: "'Trebuchet MS', 'Arial Rounded MT Bold', 'Varela Round', system-ui, sans-serif" },
  { id: 'retro', label: 'Retrô (Verdana, anos 2000)', stack: 'Verdana, Tahoma, Geneva, sans-serif' },
  { id: 'maquina', label: 'Máquina de escrever', stack: "'Courier New', Courier, monospace" },
];

export const UI_CORNERS: { id: UiCorners; label: string }[] = [
  { id: 'padrao', label: 'Padrão' },
  { id: 'retos', label: 'Retos' },
  { id: 'redondos', label: 'Bem arredondados' },
];

export const ACCENT_SWATCHES: { label: string; hex: string }[] = [
  { label: 'Azul Aero', hex: '#0a4c8c' },
  { label: 'Rosa chiclete', hex: '#b0306e' },
  { label: 'Lilás', hex: '#6a46b0' },
  { label: 'Verde musgo', hex: '#1f6f4a' },
  { label: 'Turquesa', hex: '#0d7480' },
  { label: 'Laranja', hex: '#b4531a' },
  { label: 'Cereja', hex: '#a3243b' },
  { label: 'Grafite', hex: '#3b4652' },
];

export const WALLPAPER_SWATCHES: { label: string; hex: string }[] = [
  { label: 'Céu', hex: '#cfe3f5' },
  { label: 'Algodão-doce', hex: '#f6d7e8' },
  { label: 'Lavanda', hex: '#e2dcf5' },
  { label: 'Menta', hex: '#d5efe3' },
  { label: 'Pêssego', hex: '#f8e0cc' },
  { label: 'Papel', hex: '#efe2c6' },
  { label: 'Noite', hex: '#0d1626' },
  { label: 'Grafite', hex: '#23272e' },
];

const HEX = /^#[0-9a-f]{6}$/i;

export function sanitizeUiPrefs(raw: unknown): UiPrefs {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    accent: typeof r.accent === 'string' && HEX.test(r.accent) ? r.accent.toLowerCase() : null,
    wallpaper: typeof r.wallpaper === 'string' && HEX.test(r.wallpaper) ? r.wallpaper.toLowerCase() : null,
    font: UI_FONTS.some((f) => f.id === r.font) ? (r.font as UiFont) : 'padrao',
    corners: UI_CORNERS.some((c) => c.id === r.corners) ? (r.corners as UiCorners) : 'padrao',
  };
}

/**
 * Aplica as escolhas como variáveis CSS no <html>.
 * Esta função é serializada no script de inicialização (antes da pintura),
 * por isso não usa nada de fora dela.
 */
export function applyUiPrefs(raw: unknown): void {
  let p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  let root = document.documentElement;
  let st = root.style;
  let hex = /^#[0-9a-f]{6}$/i;
  let props = [
    '--accent', '--accent-deep', '--on-accent', '--glow', '--titlebar-from', '--titlebar-to',
    '--bg', '--bg2', '--wall-glow', '--font-ui', '--font-display', '--radius', '--radius-sm',
  ];
  for (let i = 0; i < props.length; i++) st.removeProperty(props[i]);

  function lum(h: string) {
    let out = 0;
    let w = [0.2126, 0.7152, 0.0722];
    for (let k = 0; k < 3; k++) {
      let c = parseInt(h.slice(1 + k * 2, 3 + k * 2), 16) / 255;
      c = c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      out += w[k] * c;
    }
    return out;
  }

  let highContrast = root.dataset.theme === 'alto-contraste';
  let accent = typeof p.accent === 'string' && hex.test(p.accent) ? p.accent : null;
  let wall = typeof p.wallpaper === 'string' && hex.test(p.wallpaper) ? p.wallpaper : null;

  if (!highContrast && accent) {
    st.setProperty('--accent', accent);
    st.setProperty('--accent-deep', 'color-mix(in srgb, ' + accent + ' 78%, #000)');
    // Texto sobre o botão principal: preto ou branco, o que contrastar mais.
    st.setProperty('--on-accent', lum(accent) > 0.179 ? '#111111' : '#ffffff');
    st.setProperty('--glow', 'color-mix(in srgb, ' + accent + ' 45%, transparent)');
    st.setProperty('--titlebar-from', 'color-mix(in srgb, ' + accent + ' 12%, var(--surface))');
    st.setProperty('--titlebar-to', 'color-mix(in srgb, ' + accent + ' 32%, var(--surface))');
  }
  if (!highContrast && wall) {
    let light = lum(wall) > 0.35;
    st.setProperty('--bg', wall);
    st.setProperty('--bg2', 'color-mix(in srgb, ' + wall + ' 70%, ' + (light ? '#ffffff' : '#000000') + ')');
    st.setProperty('--wall-glow', 'color-mix(in srgb, ' + (accent || wall) + ' 35%, transparent)');
  }

  let fonts: Record<string, string> = {
    serifa: "Georgia, 'Times New Roman', serif",
    arredondada: "'Trebuchet MS', 'Arial Rounded MT Bold', 'Varela Round', system-ui, sans-serif",
    retro: 'Verdana, Tahoma, Geneva, sans-serif',
    maquina: "'Courier New', Courier, monospace",
  };
  let font = typeof p.font === 'string' ? fonts[p.font] : undefined;
  if (font && root.dataset.font !== 'atkinson') {
    st.setProperty('--font-ui', font);
    st.setProperty('--font-display', font);
  }

  if (p.corners === 'retos') {
    st.setProperty('--radius', '2px');
    st.setProperty('--radius-sm', '2px');
  } else if (p.corners === 'redondos') {
    st.setProperty('--radius', '16px');
    st.setProperty('--radius-sm', '10px');
  }
}

/** Lê a escolha salva neste navegador e aplica (usado quando o tema base muda). */
export function reapplyStoredUi() {
  try {
    applyUiPrefs(JSON.parse(localStorage.getItem(UI_PREFS_KEY) || '{}'));
  } catch {
    /* ignora */
  }
}
