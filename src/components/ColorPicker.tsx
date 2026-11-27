'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

/* ------------------------------------------------------------------ */
/* Conversões                                                           */
/* ------------------------------------------------------------------ */

type Hsv = { h: number; s: number; v: number }; // h 0–360, s e v 0–1

const HEX_RE = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

export function normalizeHex(input: string): string | null {
  const m = HEX_RE.exec(input.trim());
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return `#${h}`;
}

function hexToHsv(hex: string): Hsv {
  const n = normalizeHex(hex) ?? '#000000';
  const r = parseInt(n.slice(1, 3), 16) / 255;
  const g = parseInt(n.slice(3, 5), 16) / 255;
  const b = parseInt(n.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return `#${rgb.map((n) => Math.round((n + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}

function rgbStringToHex(rgb: string): string | null {
  const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?/i.exec(rgb);
  if (!m) return null;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return null; // transparente
  return `#${[m[1], m[2], m[3]].map((n) => Math.round(Number(n)).toString(16).padStart(2, '0')).join('')}`;
}

/* ------------------------------------------------------------------ */
/* Cores do site e recentes                                            */
/* ------------------------------------------------------------------ */

const SITE_VARS: { v: string; label: string }[] = [
  { v: '--accent', label: 'Destaque' },
  { v: '--accent-deep', label: 'Destaque escuro' },
  { v: '--bg', label: 'Papel de parede' },
  { v: '--bg2', label: 'Papel de parede 2' },
  { v: '--surface', label: 'Janela' },
  { v: '--surface-alt', label: 'Janela alternativa' },
  { v: '--titlebar-to', label: 'Barra de título' },
  { v: '--text', label: 'Texto' },
  { v: '--text-muted', label: 'Texto secundário' },
  { v: '--border', label: 'Borda' },
  { v: '--danger', label: 'Alerta' },
  { v: '--success', label: 'Sucesso' },
];

/** Lê as cores atuais da interface (já com o tema e as escolhas da pessoa). */
function readSiteColors(): { hex: string; label: string }[] {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const out: { hex: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const item of SITE_VARS) {
    probe.style.color = `var(${item.v})`;
    const hex = rgbStringToHex(getComputedStyle(probe).color);
    if (hex && !seen.has(hex)) {
      seen.add(hex);
      out.push({ hex, label: item.label });
    }
  }
  probe.remove();
  return out;
}

const RECENT_KEY = 'recent-colors';
const readRecent = (): string[] => {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((c): c is string => typeof c === 'string' && Boolean(normalizeHex(c))).slice(0, 10) : [];
  } catch {
    return [];
  }
};
const pushRecent = (hex: string) => {
  try {
    const next = [hex, ...readRecent().filter((c) => c !== hex)].slice(0, 10);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignora */
  }
};

type EyeDropperCtor = new () => { open(): Promise<{ sRGBHex: string }> };

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

type Props = { value: string; onChange: (hex: string) => void; label: string; compact?: boolean };

/**
 * Seletor de cor completo: qualquer cor (área de saturação e brilho + matiz),
 * código hexadecimal, conta-gotas para pegar qualquer cor da tela (navegadores
 * compatíveis), cores atuais do site e cores usadas recentemente.
 */
export function ColorPicker({ value, onChange, label, compact = false }: Props) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [hexText, setHexText] = useState(value);
  const [site, setSite] = useState<{ hex: string; label: string }[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [canDrop, setCanDrop] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(value);

  // Valor mudou de fora (tema pronto, restaurar): sincroniza.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setHsv(hexToHsv(value));
      setHexText(value);
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    setSite(readSiteColors());
    setRecent(readRecent());
    setCanDrop('EyeDropper' in window);
    // Mantém o painel dentro da tela (ex.: seletor no fim de uma linha, no celular).
    requestAnimationFrame(() => {
      const el = panel.current;
      if (!el) return;
      el.style.left = '0px';
      const r = el.getBoundingClientRect();
      const overflow = r.right - (window.innerWidth - 8);
      if (overflow > 0) el.style.left = `${-Math.min(overflow, r.left - 8)}px`;
    });
    const onDown = (e: globalThis.PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const emit = useCallback(
    (hex: string, nextHsv?: Hsv) => {
      lastEmitted.current = hex;
      setHexText(hex);
      if (nextHsv) setHsv(nextHsv);
      onChange(hex);
    },
    [onChange],
  );

  const close = () => {
    setOpen(false);
    pushRecent(lastEmitted.current);
  };

  const fromHsv = (next: Hsv) => emit(hsvToHex(next), next);
  const fromHex = (hex: string) => emit(hex, hexToHsv(hex));

  const pickAt = (clientX: number, clientY: number) => {
    const el = area.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const v = 1 - Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    fromHsv({ ...hsv, s, v });
  };

  const onAreaDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pickAt(e.clientX, e.clientY);
  };
  const onAreaMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) pickAt(e.clientX, e.clientY);
  };
  const onAreaKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, Partial<Hsv>> = {
      ArrowLeft: { s: Math.max(0, hsv.s - step) },
      ArrowRight: { s: Math.min(1, hsv.s + step) },
      ArrowUp: { v: Math.min(1, hsv.v + step) },
      ArrowDown: { v: Math.max(0, hsv.v - step) },
    };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      fromHsv({ ...hsv, ...m });
    }
  };

  const eyedrop = async () => {
    const Ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (!Ctor) return;
    try {
      const { sRGBHex } = await new Ctor().open();
      const hex = normalizeHex(sRGBHex) ?? rgbStringToHex(sRGBHex);
      if (hex) fromHex(hex);
    } catch {
      /* a pessoa cancelou */
    }
  };

  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  return (
    <div className={`cpick${compact ? ' cpick--compact' : ''}`} ref={wrap}>
      <button
        type="button"
        className="cpick__trigger"
        aria-expanded={open}
        aria-controls={`${uid}-panel`}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="cpick__swatch" style={{ background: value }} aria-hidden="true" />
        {!compact && (
          <span className="cpick__text">
            <span>{label}</span>
            <code>{value}</code>
          </span>
        )}
        {compact && <span className="sr-only">{`${label}: ${value}`}</span>}
      </button>

      {open && (
        <div
          ref={panel}
          id={`${uid}-panel`}
          className="cpick__panel"
          role="dialog"
          aria-label={`Escolher cor: ${label}`}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              close();
            }
          }}
        >
          <div
            ref={area}
            className="cpick__area"
            style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }}
            tabIndex={0}
            role="slider"
            aria-label="Saturação e brilho (setas: esquerda e direita para saturação, cima e baixo para brilho)"
            aria-valuetext={`Saturação ${Math.round(hsv.s * 100)}%, brilho ${Math.round(hsv.v * 100)}%`}
            aria-valuenow={Math.round(hsv.s * 100)}
            onPointerDown={onAreaDown}
            onPointerMove={onAreaMove}
            onKeyDown={onAreaKey}
          >
            <span
              className="cpick__handle"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: value }}
              aria-hidden="true"
            />
          </div>

          <label className="sr-only" htmlFor={`${uid}-hue`}>
            Matiz
          </label>
          <input
            id={`${uid}-hue`}
            className="cpick__hue"
            type="range"
            min={0}
            max={359}
            value={Math.round(hsv.h)}
            onChange={(e) => fromHsv({ ...hsv, h: Number(e.target.value), s: hsv.s || 0.6, v: hsv.v || 0.6 })}
            aria-valuetext={`Matiz ${Math.round(hsv.h)} graus`}
          />

          <div className="cpick__row">
            <span className="cpick__swatch cpick__swatch--big" style={{ background: value }} aria-hidden="true" />
            <label className="sr-only" htmlFor={`${uid}-hex`}>
              Código da cor
            </label>
            <input
              id={`${uid}-hex`}
              className="cpick__hex"
              type="text"
              value={hexText}
              maxLength={7}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => {
                setHexText(e.target.value);
                const hex = normalizeHex(e.target.value);
                if (hex && e.target.value.replace('#', '').length === 6) fromHex(hex);
              }}
              onBlur={() => setHexText(lastEmitted.current)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const hex = normalizeHex(hexText);
                  if (hex) fromHex(hex);
                }
              }}
            />
            {canDrop && (
              <button type="button" className="btn cpick__drop" onClick={() => void eyedrop()} title="Pegar uma cor de qualquer lugar da tela">
                Conta-gotas
              </button>
            )}
          </div>

          {site.length > 0 && (
            <fieldset className="cpick__group">
              <legend>Cores do site</legend>
              <div className="cpick__chips">
                {site.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    className="cpick__chip"
                    style={{ background: c.hex }}
                    aria-label={`${c.label} ${c.hex}`}
                    title={`${c.label} ${c.hex}`}
                    aria-pressed={value === c.hex}
                    onClick={() => fromHex(c.hex)}
                  />
                ))}
              </div>
            </fieldset>
          )}

          {recent.length > 0 && (
            <fieldset className="cpick__group">
              <legend>Usadas recentemente</legend>
              <div className="cpick__chips">
                {recent.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="cpick__chip"
                    style={{ background: c }}
                    aria-label={c}
                    title={c}
                    aria-pressed={value === c}
                    onClick={() => fromHex(c)}
                  />
                ))}
              </div>
            </fieldset>
          )}

          <div className="cpick__row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--primary" onClick={close}>
              Pronto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
