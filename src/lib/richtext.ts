// Texto rico armazenado como JSON (formato ProseMirror/Tiptap), nunca como HTML.
// O servidor aceita apenas os nós e marcas desta lista; o resto é descartado.

export type RTMark =
  | { type: 'bold' | 'italic' | 'underline' | 'strike' | 'code' }
  | { type: 'link'; attrs: { href: string } };

export type RTNode =
  | { type: 'text'; text: string; marks?: RTMark[] }
  | { type: 'paragraph'; content?: RTNode[] }
  | { type: 'heading'; attrs: { level: 2 | 3 }; content?: RTNode[] }
  | { type: 'bulletList'; content?: RTNode[] }
  | { type: 'orderedList'; attrs?: { start: number }; content?: RTNode[] }
  | { type: 'listItem'; content?: RTNode[] }
  | { type: 'blockquote'; content?: RTNode[] }
  | { type: 'codeBlock'; content?: RTNode[] }
  | { type: 'hardBreak' }
  | { type: 'horizontalRule' }
  | { type: 'image'; attrs: { mediaId: string; alt: string } };

export type RTDoc = { type: 'doc'; content: RTNode[] };

export type PostBody = { v: 1; doc: RTDoc; text: string };

export const MAX_TEXT = 20000;
const MAX_DEPTH = 12;
const MAX_NODES = 5000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_INLINE_IMAGES = 20;
const CONTAINERS = new Set(['paragraph', 'bulletList', 'listItem', 'blockquote', 'codeBlock']);
const SIMPLE_MARKS = new Set(['bold', 'italic', 'underline', 'strike', 'code']);

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

export function safeHref(href: unknown): string | null {
  if (typeof href !== 'string' || href.length > 2000) return null;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function cleanMarks(raw: unknown): RTMark[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: RTMark[] = [];
  for (const m of raw) {
    if (!isObj(m) || typeof m.type !== 'string') continue;
    if (SIMPLE_MARKS.has(m.type)) out.push({ type: m.type as 'bold' });
    else if (m.type === 'link' && isObj(m.attrs)) {
      const href = safeHref(m.attrs.href);
      if (href) out.push({ type: 'link', attrs: { href } });
    }
  }
  return out.length ? out : undefined;
}

function cleanNode(raw: unknown, depth: number, budget: { n: number }): RTNode | null {
  if (!isObj(raw) || typeof raw.type !== 'string' || depth > MAX_DEPTH) return null;
  if (--budget.n < 0) return null;
  const children = () => {
    if (!Array.isArray(raw.content)) return undefined;
    const list = raw.content.map((c) => cleanNode(c, depth + 1, budget)).filter((c): c is RTNode => c !== null);
    return list.length ? list : undefined;
  };

  switch (raw.type) {
    case 'text': {
      if (typeof raw.text !== 'string' || raw.text.length === 0) return null;
      const marks = cleanMarks(raw.marks);
      return marks ? { type: 'text', text: raw.text, marks } : { type: 'text', text: raw.text };
    }
    case 'heading': {
      const level = isObj(raw.attrs) && raw.attrs.level === 3 ? 3 : 2;
      return { type: 'heading', attrs: { level }, content: children() };
    }
    case 'orderedList': {
      const start = isObj(raw.attrs) && Number.isInteger(raw.attrs.start) ? Math.max(1, Number(raw.attrs.start)) : 1;
      return { type: 'orderedList', attrs: { start }, content: children() };
    }
    case 'hardBreak':
    case 'horizontalRule':
      return { type: raw.type };
    case 'image': {
      // Guarda só a referência à mídia; a URL (temporária) é gerada na exibição.
      const a = isObj(raw.attrs) ? raw.attrs : {};
      if (typeof a.mediaId !== 'string' || !UUID_RE.test(a.mediaId)) return null;
      const alt = typeof a.alt === 'string' ? a.alt.slice(0, 500) : '';
      return { type: 'image', attrs: { mediaId: a.mediaId, alt } };
    }
    default:
      if (CONTAINERS.has(raw.type)) return { type: raw.type as 'paragraph', content: children() };
      return null;
  }
}

/** Devolve um documento limpo, ou null se a entrada não for um documento válido. */
export function sanitizeDoc(raw: unknown): RTDoc | null {
  if (!isObj(raw) || raw.type !== 'doc' || !Array.isArray(raw.content)) return null;
  const budget = { n: MAX_NODES };
  const content = raw.content.map((c) => cleanNode(c, 1, budget)).filter((c): c is RTNode => c !== null);
  return { type: 'doc', content };
}

/** IDs das imagens usadas no texto, na ordem em que aparecem. */
export function docMediaIds(doc: RTDoc): string[] {
  const ids: string[] = [];
  const walk = (nodes: RTNode[] | undefined) => {
    for (const n of nodes ?? []) {
      if (n.type === 'image') ids.push(n.attrs.mediaId);
      else if ('content' in n) walk(n.content);
    }
  };
  walk(doc.content);
  return Array.from(new Set(ids));
}

/** Texto puro do documento (para prévias, busca e validação de tamanho). */
export function docText(doc: RTDoc): string {
  const parts: string[] = [];
  const walk = (nodes: RTNode[] | undefined) => {
    for (const n of nodes ?? []) {
      if (n.type === 'text') parts.push(n.text);
      else if (n.type === 'hardBreak') parts.push('\n');
      else if ('content' in n) {
        walk(n.content);
        parts.push('\n');
      }
    }
  };
  walk(doc.content);
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim();
}

export function isPostBody(v: unknown): v is PostBody {
  return isObj(v) && v.v === 1 && isObj(v.doc) && typeof v.text === 'string';
}
