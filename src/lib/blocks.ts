import { sanitizeDoc, type RTDoc } from './richtext';

// Blocos de uma página de wiki. Salvos como JSON e validados no servidor.

export type CollectionItem = { id: string; name: string; status: string; note: string };

export type Block =
  | { id: string; type: 'text'; doc: RTDoc }
  | { id: string; type: 'collection'; title: string; statuses: string[]; items: CollectionItem[] }
  | { id: string; type: 'divider'; style: 'linha' | 'estrelas' | 'pontos' }
  | { id: string; type: 'blog' }
  | { id: string; type: 'images'; mediaIds: string[]; layout: 'grade' | 'mosaico' }
  | { id: string; type: 'playlist'; playlistId: string | null };

export const MAX_BLOCKS = 60;
export const MAX_ITEMS = 300;
export const DEFAULT_STATUSES = ['Tenho', 'Quero', 'Já tive'];

export const newId = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

const ID_RE = /^[a-z0-9]{1,24}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_BLOCK_IMAGES = 30;
const cleanId = (v: unknown) => (typeof v === 'string' && ID_RE.test(v) ? v : newId());
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

export const emptyDoc = (): RTDoc => ({ type: 'doc', content: [{ type: 'paragraph' }] });

export function newBlock(type: Block['type']): Block {
  switch (type) {
    case 'text':
      return { id: newId(), type: 'text', doc: emptyDoc() };
    case 'collection':
      return { id: newId(), type: 'collection', title: 'Minha coleção', statuses: [...DEFAULT_STATUSES], items: [] };
    case 'divider':
      return { id: newId(), type: 'divider', style: 'estrelas' };
    case 'blog':
      return { id: newId(), type: 'blog' };
    case 'images':
      return { id: newId(), type: 'images', mediaIds: [], layout: 'mosaico' };
    case 'playlist':
      return { id: newId(), type: 'playlist', playlistId: null };
  }
}

export function blockPlaylistIds(blocks: Block[]): string[] {
  return Array.from(new Set(blocks.flatMap((b) => (b.type === 'playlist' && b.playlistId ? [b.playlistId] : []))));
}

/** Todas as imagens usadas numa página (para a tabela page_media). */
export function blockMediaIds(blocks: Block[]): string[] {
  return Array.from(new Set(blocks.flatMap((b) => (b.type === 'images' ? b.mediaIds : []))));
}

export function sanitizeBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  const out: Block[] = [];
  for (const b of raw.slice(0, MAX_BLOCKS)) {
    if (!isObj(b)) continue;
    const id = cleanId(b.id);
    switch (b.type) {
      case 'text': {
        const doc = sanitizeDoc(b.doc);
        if (doc) out.push({ id, type: 'text', doc });
        break;
      }
      case 'collection': {
        const statuses = (Array.isArray(b.statuses) ? b.statuses : DEFAULT_STATUSES)
          .map((s) => str(s, 30))
          .filter(Boolean)
          .slice(0, 8);
        const safeStatuses = statuses.length ? statuses : [...DEFAULT_STATUSES];
        const items = (Array.isArray(b.items) ? b.items : [])
          .slice(0, MAX_ITEMS)
          .filter(isObj)
          .map((it) => ({
            id: cleanId(it.id),
            name: str(it.name, 120),
            status: safeStatuses.includes(str(it.status, 30)) ? str(it.status, 30) : safeStatuses[0],
            note: str(it.note, 500),
          }))
          .filter((it) => it.name);
        out.push({ id, type: 'collection', title: str(b.title, 80), statuses: safeStatuses, items });
        break;
      }
      case 'divider': {
        const style = b.style === 'linha' || b.style === 'pontos' ? b.style : 'estrelas';
        out.push({ id, type: 'divider', style });
        break;
      }
      case 'blog':
        out.push({ id, type: 'blog' });
        break;
      case 'images': {
        const mediaIds = Array.from(
          new Set((Array.isArray(b.mediaIds) ? b.mediaIds : []).filter((m): m is string => typeof m === 'string' && UUID_RE.test(m))),
        ).slice(0, MAX_BLOCK_IMAGES);
        out.push({ id, type: 'images', mediaIds, layout: b.layout === 'grade' ? 'grade' : 'mosaico' });
        break;
      }
      case 'playlist':
        out.push({
          id,
          type: 'playlist',
          playlistId: typeof b.playlistId === 'string' && UUID_RE.test(b.playlistId) ? b.playlistId : null,
        });
        break;
    }
  }
  return out;
}

// Modelos iniciais de wiki (RF-11)
export type TemplateId = 'branco' | 'colecao' | 'blog' | 'diario' | 'colecao-blog';

export const TEMPLATES: { id: TemplateId; label: string; hint: string }[] = [
  { id: 'colecao-blog', label: 'Coleção + blog', hint: 'Lista do que você tem e quer, e um blog sobre o assunto.' },
  { id: 'colecao', label: 'Coleção', hint: 'Itens com status: tenho, quero, já tive.' },
  { id: 'blog', label: 'Blog', hint: 'Reúne os posts que você vincular a esta wiki.' },
  { id: 'diario', label: 'Diário', hint: 'Uma página para escrever livremente.' },
  { id: 'branco', label: 'Em branco', hint: 'Comece do zero.' },
];

const textDoc = (text: string): RTDoc => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

export function templatePages(template: TemplateId): { title: string; blocks: Block[] }[] {
  const collection = (): Block => ({ ...(newBlock('collection') as Extract<Block, { type: 'collection' }>), title: 'Minha coleção' });
  switch (template) {
    case 'colecao':
      return [{ title: 'Coleção', blocks: [collection()] }];
    case 'blog':
      return [{ title: 'Blog', blocks: [{ id: newId(), type: 'text', doc: textDoc('Posts vinculados a esta wiki aparecem aqui.') }, newBlock('blog')] }];
    case 'diario':
      return [{ title: 'Diário', blocks: [newBlock('text')] }];
    case 'colecao-blog':
      return [
        { title: 'Coleção', blocks: [collection()] },
        { title: 'Blog', blocks: [newBlock('blog')] },
      ];
    default:
      return [{ title: 'Início', blocks: [newBlock('text')] }];
  }
}
