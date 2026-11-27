// Ajustes de cor e luz aplicados pixel a pixel. Nenhum ajuste altera a geometria
// da cena (RF-34): só rotação/espelhamento inteiros são permitidos, fora daqui.

export type Adjustments = {
  exposure: number; // -100..100
  brightness: number;
  contrast: number;
  highlights: number;
  shadows: number;
  saturation: number;
  vibrance: number;
  temperature: number;
  tint: number;
  fade: number; // 0..100
  sepia: number; // 0..100
  vignette: number; // 0..100
  grain: number; // 0..100
  split: number; // -100..100 tonalização dividida: + rosa/lilás, − âmbar/verde-água
  glow: number; // 0..100 brilho difuso (bloom)
  leak: number; // 0..100 luz vazada de filme, quente, vinda dos cantos
};

export const ZERO: Adjustments = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  saturation: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  fade: 0,
  sepia: 0,
  vignette: 0,
  grain: 0,
  split: 0,
  glow: 0,
  leak: 0,
};

export const ADJUSTMENT_FIELDS: { key: keyof Adjustments; label: string; min: number; max: number }[] = [
  { key: 'exposure', label: 'Exposição', min: -100, max: 100 },
  { key: 'brightness', label: 'Brilho', min: -100, max: 100 },
  { key: 'contrast', label: 'Contraste', min: -100, max: 100 },
  { key: 'highlights', label: 'Realces', min: -100, max: 100 },
  { key: 'shadows', label: 'Sombras', min: -100, max: 100 },
  { key: 'saturation', label: 'Saturação', min: -100, max: 100 },
  { key: 'vibrance', label: 'Vibração', min: -100, max: 100 },
  { key: 'temperature', label: 'Temperatura', min: -100, max: 100 },
  { key: 'tint', label: 'Matiz', min: -100, max: 100 },
  { key: 'fade', label: 'Desbotar', min: 0, max: 100 },
  { key: 'vignette', label: 'Vinheta', min: 0, max: 100 },
  { key: 'grain', label: 'Granulação', min: 0, max: 100 },
  { key: 'split', label: 'Tons divididos (âmbar ↔ rosa)', min: -100, max: 100 },
  { key: 'glow', label: 'Brilho difuso', min: 0, max: 100 },
  { key: 'leak', label: 'Luz vazada', min: 0, max: 100 },
];

// Filtros próprios com a estética "Tumblr" dos apps de câmera como o Cymera:
// cores lavadas, pretos levantados, tons pastel, granulação de filme e luz vazada.
// Nenhum filtro mexe na geometria da foto.
export const FILTERS: { id: string; label: string; adj: Partial<Adjustments> }[] = [
  { id: 'original', label: 'Original', adj: {} },
  { id: 'sonho', label: 'Sonho', adj: { glow: 60, fade: 22, split: 35, saturation: -12, brightness: 8, contrast: -10 } },
  { id: 'pastel', label: 'Pastel', adj: { fade: 40, saturation: -12, brightness: 18, split: 45, contrast: -22, glow: 15 } },
  { id: 'indie', label: 'Indie', adj: { fade: 30, split: -45, saturation: -18, contrast: 8, grain: 22, vignette: 18 } },
  { id: 'fim-de-tarde', label: 'Fim de tarde', adj: { leak: 80, temperature: 24, fade: 18, glow: 20, saturation: 6 } },
  { id: 'filme-35', label: 'Filme 35mm', adj: { grain: 40, fade: 24, split: -20, contrast: 12, vignette: 26, saturation: -8 } },
  { id: 'lavanda', label: 'Lavanda', adj: { tint: 14, temperature: -10, fade: 26, split: 30, saturation: -20, brightness: 6 } },
  { id: 'cereja', label: 'Cereja', adj: { split: 60, tint: 8, contrast: 10, vibrance: 14, glow: 15 } },
  { id: 'neblina', label: 'Neblina', adj: { fade: 48, glow: 35, contrast: -22, saturation: -24, brightness: 10 } },
  { id: 'grunge', label: 'Grunge 2013', adj: { contrast: 34, saturation: -38, fade: 16, grain: 45, vignette: 40, split: -15 } },
  { id: 'polaroide', label: 'Polaroide', adj: { fade: 28, temperature: 12, contrast: -12, saturation: -10, vignette: 22, leak: 18 } },
  { id: 'aurora', label: 'Aurora', adj: { temperature: 18, saturation: 10, fade: 12, contrast: -6, brightness: 4 } },
  { id: 'lomo', label: 'Lomo', adj: { contrast: 32, saturation: 22, vignette: 50, shadows: -10 } },
  { id: 'algodao', label: 'Algodão', adj: { brightness: 12, saturation: -28, fade: 22, tint: 6, contrast: -10 } },
  { id: 'noite', label: 'Noite azul', adj: { temperature: -30, contrast: 12, shadows: 12, saturation: -8 } },
  { id: 'vivido', label: 'Vívido', adj: { vibrance: 45, contrast: 14, saturation: 8 } },
  { id: 'vintage', label: 'Vintage', adj: { sepia: 38, fade: 20, grain: 28, vignette: 28, contrast: -8 } },
  { id: 'sepia', label: 'Sépia', adj: { sepia: 85, contrast: 8 } },
  { id: 'pb', label: 'P&B', adj: { saturation: -100, contrast: 18 } },
  { id: 'pb-suave', label: 'P&B suave', adj: { saturation: -100, fade: 25, contrast: -10, grain: 18 } },
];

export type EditParams = {
  filter: string;
  intensity: number; // 0..100
  adj: Adjustments;
  rotate: 0 | 90 | 180 | 270;
  flip: boolean;
};

export const DEFAULT_EDIT: EditParams = { filter: 'original', intensity: 100, adj: { ...ZERO }, rotate: 0, flip: false };

const clampNum = (v: unknown, min: number, max: number, fallback = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

export function sanitizeEdit(raw: unknown): EditParams {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const adjRaw = (typeof r.adj === 'object' && r.adj !== null ? r.adj : {}) as Record<string, unknown>;
  const adj = { ...ZERO };
  for (const f of ADJUSTMENT_FIELDS) adj[f.key] = clampNum(adjRaw[f.key], f.min, f.max);
  adj.sepia = clampNum(adjRaw.sepia, 0, 100);
  const rotate = [0, 90, 180, 270].includes(r.rotate as number) ? (r.rotate as EditParams['rotate']) : 0;
  return {
    filter: FILTERS.some((f) => f.id === r.filter) ? String(r.filter) : 'original',
    intensity: clampNum(r.intensity, 0, 100, 100),
    adj,
    rotate,
    flip: r.flip === true,
  };
}

/** Combina o filtro (na intensidade escolhida) com os ajustes manuais. */
export function effectiveAdjustments(p: EditParams): Adjustments {
  const filter = FILTERS.find((f) => f.id === p.filter)?.adj ?? {};
  const k = p.intensity / 100;
  const out = { ...ZERO };
  (Object.keys(ZERO) as (keyof Adjustments)[]).forEach((key) => {
    out[key] = (filter[key] ?? 0) * k + p.adj[key];
  });
  return out;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Aplica os ajustes em um ImageData (modifica no lugar). */
export function applyAdjustments(img: ImageData, a: Adjustments) {
  const { data, width, height } = img;
  const exposure = Math.pow(2, a.exposure / 100);
  const brightness = a.brightness / 400;
  const contrast = 1 + a.contrast / 100;
  const hi = a.highlights / 250;
  const sh = a.shadows / 250;
  const sat = 1 + a.saturation / 100;
  const vib = a.vibrance / 100;
  const temp = (a.temperature / 100) * 0.2;
  const tint = (a.tint / 100) * 0.12;
  const fade = a.fade / 100;
  const sepia = a.sepia / 100;
  const vig = a.vignette / 100;
  const grain = a.grain / 100;
  const split = a.split / 100;
  const cx = width / 2;
  const cy = height / 2;
  const maxD = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let r = data[i] / 255;
      let g = data[i + 1] / 255;
      let b = data[i + 2] / 255;

      // Luz
      r = r * exposure + brightness;
      g = g * exposure + brightness;
      b = b * exposure + brightness;

      let l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (hi !== 0 || sh !== 0) {
        const lc = clamp01(l);
        const delta = hi * lc * lc + sh * (1 - lc) * (1 - lc);
        r += delta;
        g += delta;
        b += delta;
      }

      // Contraste
      r = (r - 0.5) * contrast + 0.5;
      g = (g - 0.5) * contrast + 0.5;
      b = (b - 0.5) * contrast + 0.5;

      // Temperatura e matiz
      r += temp;
      b -= temp;
      g -= tint;

      // Saturação e vibração
      l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      let s = sat;
      if (vib !== 0) {
        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        const current = mx - mn;
        s *= 1 + vib * (1 - clamp01(current));
      }
      r = l + (r - l) * s;
      g = l + (g - l) * s;
      b = l + (b - l) * s;

      // Sépia
      if (sepia > 0) {
        const sr = 0.393 * r + 0.769 * g + 0.189 * b;
        const sg = 0.349 * r + 0.686 * g + 0.168 * b;
        const sb = 0.272 * r + 0.534 * g + 0.131 * b;
        r += (sr - r) * sepia;
        g += (sg - g) * sepia;
        b += (sb - b) * sepia;
      }

      // Tons divididos: realces e sombras recebem cores opostas
      if (split !== 0) {
        const lt = clamp01(0.2126 * r + 0.7152 * g + 0.0722 * b);
        const k = Math.abs(split) * 0.3;
        const hiW = lt * lt;
        const shW = (1 - lt) * (1 - lt);
        if (split > 0) {
          // realces rosados, sombras lilás
          r += k * (hiW * 0.75 + shW * 0.3);
          g -= k * (hiW * 0.25 + shW * 0.25);
          b += k * (hiW * 0.3 + shW * 0.7);
        } else {
          // realces âmbar, sombras verde-água
          r += k * (hiW * 0.7 - shW * 0.35);
          g += k * (hiW * 0.35 + shW * 0.2);
          b += k * (-hiW * 0.45 + shW * 0.45);
        }
      }

      // Desbotar (levanta os pretos)
      if (fade > 0) {
        r = r * (1 - fade * 0.25) + fade * 0.1;
        g = g * (1 - fade * 0.25) + fade * 0.1;
        b = b * (1 - fade * 0.25) + fade * 0.1;
      }

      // Vinheta
      if (vig > 0) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy) / maxD;
        const f = 1 - vig * 0.75 * Math.max(0, d - 0.35) / 0.65;
        r *= f;
        g *= f;
        b *= f;
      }

      // Granulação determinística (a mesma foto gera o mesmo resultado)
      if (grain > 0) {
        const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const n = (h - Math.floor(h) - 0.5) * grain * 0.16;
        r += n;
        g += n;
        b += n;
      }

      data[i] = clamp01(r) * 255;
      data[i + 1] = clamp01(g) * 255;
      data[i + 2] = clamp01(b) * 255;
    }
  }
}

/**
 * Desenha a imagem com rotação/espelhamento e ajustes, limitada a `maxSide` pixels.
 * Reencodar em canvas descarta EXIF e GPS do arquivo original.
 */
export function renderToCanvas(source: ImageBitmap, params: EditParams, maxSide: number): HTMLCanvasElement {
  const rotated = params.rotate === 90 || params.rotate === 270;
  const srcW = rotated ? source.height : source.width;
  const srcH = rotated ? source.width : source.height;
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((params.rotate * Math.PI) / 180);
  if (params.flip) ctx.scale(-1, 1);
  const dw = (rotated ? h : w);
  const dh = (rotated ? w : h);
  ctx.drawImage(source, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  const adj = effectiveAdjustments(params);
  const isIdentity = (Object.keys(adj) as (keyof Adjustments)[]).every((k) => adj[k] === 0);
  if (!isIdentity) {
    const img = ctx.getImageData(0, 0, w, h);
    applyAdjustments(img, adj);
    ctx.putImageData(img, 0, 0);
    if (adj.glow > 0) applyGlow(canvas, ctx, adj.glow / 100);
    if (adj.leak > 0) applyLeak(ctx, w, h, adj.leak / 100);
  }
  return canvas;
}

/**
 * Brilho difuso: uma cópia desfocada (reduzida e ampliada, funciona em qualquer
 * navegador) somada por "tela". Clareia e suaviza sem mover nenhum pixel de lugar.
 */
function applyGlow(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, amount: number) {
  const w = canvas.width;
  const h = canvas.height;
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(w / 14));
  small.height = Math.max(1, Math.round(h / 14));
  const sctx = small.getContext('2d')!;
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(canvas, 0, 0, small.width, small.height);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.min(1, amount) * 0.85;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, w, h);
  ctx.restore();
}

/** Luz vazada: manchas quentes nos cantos, como em filme queimado. Determinística. */
function applyLeak(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const a = Math.min(1, amount);
  const r = Math.max(w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g1 = ctx.createRadialGradient(0, h * 0.15, 0, 0, h * 0.15, r * 0.75);
  g1.addColorStop(0, `rgba(255, 110, 30, ${a})`);
  g1.addColorStop(0.45, `rgba(255, 60, 110, ${0.55 * a})`);
  g1.addColorStop(1, 'rgba(255, 70, 90, 0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);
  const g2 = ctx.createRadialGradient(w, h, 0, w, h, r * 0.55);
  g2.addColorStop(0, `rgba(255, 180, 80, ${0.7 * a})`);
  g2.addColorStop(1, 'rgba(255, 190, 90, 0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.88): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem'))), 'image/jpeg', quality);
  });
}
