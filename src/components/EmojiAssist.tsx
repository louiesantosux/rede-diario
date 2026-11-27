'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { EMOJI_CATEGORIES, EMOJI_RECENT_KEY } from '@/lib/emojis';

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLElement;
type Saved = { start: number; end: number } | Range | null;

const TEXT_TYPES = new Set(['text', 'search', '']);

/** Campos de texto livre recebem o botão de emoji. Ficam de fora e-mail, senha, links, @ e códigos. */
function isEligible(el: EventTarget | null): el is Field {
  if (!(el instanceof HTMLElement)) return false;
  if (el.closest('[data-no-emoji]')) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) {
    return (
      TEXT_TYPES.has(el.type) &&
      !el.readOnly &&
      !el.disabled &&
      el.inputMode !== 'url' &&
      el.inputMode !== 'numeric' &&
      !el.pattern
    );
  }
  return el.isContentEditable && el.getAttribute('contenteditable') === 'true';
}

const isTextControl = (el: Field): el is HTMLInputElement | HTMLTextAreaElement =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

function readRecent(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(EMOJI_RECENT_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((e): e is string => typeof e === 'string').slice(0, 24) : [];
  } catch {
    return [];
  }
}

/**
 * Botão de emoji que aparece em qualquer campo de texto do site quando ele
 * está em foco (inclusive nos editores de texto rico). Atalho: Ctrl + ;
 */
export function EmojiAssist() {
  const [target, setTarget] = useState<Field | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState(EMOJI_CATEGORIES[0].id);
  const [recent, setRecent] = useState<string[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const viaKeyboard = useRef(false);
  const saved = useRef<Saved>(null);
  const ui = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const targetRef = useRef<Field | null>(null);
  targetRef.current = target;

  const place = useCallback(() => {
    const el = targetRef.current;
    if (!el || !el.isConnected) {
      setPos(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight) {
      setPos(null);
      return;
    }
    const single = el instanceof HTMLInputElement;
    const top = single ? r.top + Math.max(0, (r.height - 30) / 2) : r.top + 6;
    setPos({ top, left: r.right - 36 });
  }, []);

  const saveSelection = useCallback((el: Field) => {
    if (isTextControl(el)) {
      saved.current = { start: el.selectionStart ?? el.value.length, end: el.selectionEnd ?? el.value.length };
    } else {
      const sel = window.getSelection();
      saved.current = sel && sel.rangeCount && el.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    }
  }, []);

  // Segue o foco pelos campos do site.
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (ui.current?.contains(e.target as Node)) return;
      if (isEligible(e.target)) {
        setTarget(e.target);
        targetRef.current = e.target;
        requestAnimationFrame(place);
      } else {
        setTarget(null);
        setOpen(false);
      }
    };
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (next && ui.current?.contains(next)) return;
      // Espera o próximo foco: se for outro campo, o focusin troca o alvo.
      setTimeout(() => {
        const active = document.activeElement;
        if (active && ui.current?.contains(active)) return;
        if (!isEligible(active)) {
          setTarget(null);
          setOpen(false);
        }
      }, 120);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ';' && isEligible(document.activeElement)) {
        e.preventDefault();
        const el = document.activeElement as Field;
        setTarget(el);
        targetRef.current = el;
        saveSelection(el);
        place();
        viaKeyboard.current = true;
        setRecent(readRecent());
        setOpen(true);
      }
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('keydown', onKey);
    };
  }, [place, saveSelection]);

  // Acompanha rolagem e redimensionamento.
  useEffect(() => {
    if (!target) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    const ro = new ResizeObserver(update);
    ro.observe(target);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      ro.disconnect();
    };
  }, [target, place]);

  // Teclado: ao abrir pelo atalho, o foco vai para a grade de emojis.
  useEffect(() => {
    if (open && viaKeyboard.current) {
      setFocusIndex(0);
      requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>('button')?.focus());
    }
  }, [open, cat]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ui.current?.contains(t) || targetRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) targetRef.current?.focus();
  };

  const insert = (emoji: string) => {
    const el = targetRef.current;
    if (!el) return;
    el.focus();
    const s = saved.current;
    if (isTextControl(el)) {
      if (s && !(s instanceof Range)) el.setSelectionRange(s.start, s.end);
    } else if (s instanceof Range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(s);
    }

    // insertText mantém o desfazer (Ctrl+Z) e avisa o React e o editor de texto rico.
    const ok = document.execCommand('insertText', false, emoji);
    if (!ok && isTextControl(el)) {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const next = el.value.slice(0, start) + emoji + el.value.slice(end);
      if (el.maxLength > 0 && next.length > el.maxLength) return;
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, next);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    }
    saveSelection(el);

    try {
      const list = [emoji, ...readRecent().filter((e) => e !== emoji)].slice(0, 24);
      localStorage.setItem(EMOJI_RECENT_KEY, JSON.stringify(list));
      setRecent(list);
    } catch {
      /* ignora */
    }
    if (viaKeyboard.current) close(false);
  };

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (targetRef.current) saveSelection(targetRef.current);
    viaKeyboard.current = false;
    setRecent(readRecent());
    setOpen(true);
  };

  const categories = recent.length
    ? [{ id: 'recentes', label: 'Recentes', icon: '🕘', list: recent }, ...EMOJI_CATEGORIES]
    : EMOJI_CATEGORIES;
  const current = categories.find((c) => c.id === cat) ?? categories[0];

  const COLS = 8;
  const onGridKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS };
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
      return;
    }
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = Math.min(current.list.length - 1, Math.max(0, focusIndex + moves[e.key]));
    setFocusIndex(next);
    grid.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  };

  // Mantém o foco no campo ao clicar nos controles (o cursor não se perde).
  const keepFocus = (e: { preventDefault: () => void }) => {
    if (!viaKeyboard.current) e.preventDefault();
  };

  if (!target || !pos) return null;

  const panelTop = Math.min(pos.top + 36, window.innerHeight - 340);
  const panelLeft = Math.max(8, Math.min(pos.left - 280, window.innerWidth - 328));

  return (
    <div ref={ui} className="emoji-assist">
      <button
        type="button"
        className="emoji-assist__btn"
        style={{ top: pos.top, left: pos.left }}
        tabIndex={-1}
        aria-label="Inserir emoji (Ctrl + ;)"
        title="Emoji (Ctrl + ;)"
        aria-expanded={open}
        onPointerDown={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggle}
      >
        <span aria-hidden="true">☺︎</span>
      </button>

      {open && (
        <div
          className="emoji-picker"
          role="dialog"
          aria-label="Emojis"
          style={{ top: Math.max(8, panelTop), left: panelLeft }}
          onMouseDown={keepFocus}
        >
          <div className="emoji-picker__tabs" role="tablist" aria-label="Categorias">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={c.id === current.id}
                aria-label={c.label}
                title={c.label}
                className="emoji-picker__tab"
                onMouseDown={keepFocus}
                onClick={() => setCat(c.id)}
              >
                {c.icon}
              </button>
            ))}
          </div>
          <p className="emoji-picker__label">{current.label}</p>
          <div ref={grid} className="emoji-picker__grid" role="group" aria-label={current.label} onKeyDown={onGridKey}>
            {current.list.map((emoji, i) => (
              <button
                key={`${current.id}-${emoji}`}
                type="button"
                className="emoji-picker__item"
                tabIndex={i === focusIndex ? 0 : -1}
                aria-label={emoji}
                onMouseDown={keepFocus}
                onClick={() => insert(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="emoji-picker__foot">
            <span>Atalho: Ctrl + ;</span>
            <button type="button" className="btn btn--ghost" onMouseDown={keepFocus} onClick={() => close(true)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
