// Cálculo de contraste WCAG 2.2, usado no editor de temas (cliente) e na validação (servidor).

export const HEX_RE = /^#[0-9a-f]{6}$/i;

function channel(c: number) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string) {
  if (!HEX_RE.test(a) || !HEX_RE.test(b)) return 1;
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function contrastLevel(ratio: number): 'AAA' | 'AA' | 'insuficiente' {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  return 'insuficiente';
}
