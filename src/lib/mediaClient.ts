'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_EDIT, ZERO, canvasToBlob, renderToCanvas, type EditParams } from './imageFilters';

const ORIGINAL_SIDE = 2560;
const EDITED_SIDE = 2048;

/**
 * Envia uma imagem já decodificada: original sem EXIF + versão editada,
 * e registra na tabela `media`. Devolve o id e as dimensões.
 */
export async function uploadBitmap(
  supabase: SupabaseClient,
  userId: string,
  bitmap: ImageBitmap,
  params: EditParams,
  alt: string,
): Promise<{ id: string; width: number; height: number }> {
  const id = crypto.randomUUID();
  const base = `${userId}/${id}`;
  const original = await canvasToBlob(renderToCanvas(bitmap, { ...DEFAULT_EDIT, adj: { ...ZERO } }, ORIGINAL_SIDE), 0.9);
  const editedCanvas = renderToCanvas(bitmap, params, EDITED_SIDE);
  const edited = await canvasToBlob(editedCanvas, 0.86);

  const up1 = await supabase.storage.from('media').upload(`${base}/original.jpg`, original, { contentType: 'image/jpeg' });
  if (up1.error) throw up1.error;
  const up2 = await supabase.storage.from('media').upload(`${base}/edit.jpg`, edited, { contentType: 'image/jpeg' });
  if (up2.error) throw up2.error;

  const { error } = await supabase.from('media').insert({
    id,
    storage_path: `${base}/edit.jpg`,
    original_path: `${base}/original.jpg`,
    edit_params: params,
    alt_text: alt.trim().slice(0, 500),
    width: editedCanvas.width,
    height: editedCanvas.height,
  });
  if (error) throw error;
  return { id, width: editedCanvas.width, height: editedCanvas.height };
}

/** URLs assinadas (1 hora) para imagens que o usuário pode ver. */
export async function signedUrls(supabase: SupabaseClient, ids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return {};
  const { data: rows } = await supabase.from('media').select('id, storage_path').in('id', unique);
  if (!rows?.length) return {};
  const { data: signed } = await supabase.storage.from('media').createSignedUrls(
    rows.map((r) => r.storage_path as string),
    3600,
  );
  const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const out: Record<string, string> = {};
  for (const r of rows) {
    const url = byPath.get(r.storage_path as string);
    if (url) out[r.id as string] = url;
  }
  return out;
}

type JsonNode = { type?: string; attrs?: Record<string, unknown>; content?: JsonNode[] };

function collectIds(node: JsonNode | undefined, out: string[]) {
  if (!node) return;
  if (node.type === 'image' && typeof node.attrs?.mediaId === 'string') out.push(node.attrs.mediaId);
  node.content?.forEach((c) => collectIds(c, out));
}

function withSrc(node: JsonNode, urls: Record<string, string>): JsonNode {
  const next: JsonNode = { ...node };
  if (node.type === 'image' && typeof node.attrs?.mediaId === 'string') {
    next.attrs = { ...node.attrs, src: urls[node.attrs.mediaId] ?? null };
  }
  if (node.content) next.content = node.content.map((c) => withSrc(c, urls));
  return next;
}

/** Preenche as URLs das imagens de um documento salvo, para exibir no editor. */
export async function hydrateDoc<T>(supabase: SupabaseClient, doc: T): Promise<{ doc: T; hasImages: boolean }> {
  const ids: string[] = [];
  collectIds(doc as JsonNode, ids);
  if (ids.length === 0) return { doc, hasImages: false };
  const urls = await signedUrls(supabase, ids);
  return { doc: withSrc(doc as JsonNode, urls) as T, hasImages: true };
}
