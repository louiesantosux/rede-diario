// Valida o contraste WCAG 2.2 de todos os temas e gera src/app/themes.css.
// Uso: node scripts/build-themes.mjs   (sai com código 1 se algum par falhar)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { themes, checks } from './tokens.mjs';

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};
const channel = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

let failures = 0;
for (const [id, t] of Object.entries(themes)) {
  console.log(`\n${t.label}`);
  for (const [fg, bg, min, desc] of checks) {
    const ratio = contrast(t[fg], t[bg]);
    const ok = ratio >= min;
    if (!ok) failures += 1;
    console.log(`  ${ok ? 'ok   ' : 'FALHA'} ${ratio.toFixed(2).padStart(5)}:1 (mín. ${min}) ${desc}`);
  }
}

const kebab = (k) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
const css = [
  '/* Arquivo gerado por scripts/build-themes.mjs — não editar à mão. */',
  ...Object.entries(themes).map(([id, t]) => {
    const vars = Object.entries(t)
      .filter(([k]) => !['label', 'scheme'].includes(k))
      .map(([k, v]) => `  --${kebab(k)}: ${v};`)
      .join('\n');
    const selector = id === 'aero-claro' ? `:root,\n[data-theme='${id}']` : `[data-theme='${id}']`;
    return `${selector} {\n  color-scheme: ${t.scheme};\n${vars}\n}`;
  }),
  '',
].join('\n\n');

const out = fileURLToPath(new URL('../src/app/themes.css', import.meta.url));
writeFileSync(out, css);
console.log(`\n${failures === 0 ? 'Todos os pares passaram.' : `${failures} par(es) falharam.`} CSS gerado em src/app/themes.css`);
process.exit(failures === 0 ? 0 : 1);
