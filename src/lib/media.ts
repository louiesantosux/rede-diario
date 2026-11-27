import type { SupabaseClient } from '@supabase/supabase-js';

export type MediaView = { id: string; url: string; alt: string; width: number | null; height: number | null };

const URL_TTL = 60 * 60; // 1 hora

/**
 * Busca as imagens visíveis para o usuário atual e gera URLs assinadas.
 * A RLS de `media` e do Storage decide o que pode ser visto.
 */
export async function getMediaViews(supabase: SupabaseClient, ids: string[]): Promise<Record<string, MediaView>> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return {};

  const { data: rows } = await supabase
    .from('media')
    .select('id, storage_path, alt_text, width, height')
    .in('id', unique);
  if (!rows || rows.length === 0) return {};

  const { data: signed } = await supabase.storage
    .from('media')
    .createSignedUrls(
      rows.map((r) => r.storage_path as string),
      URL_TTL,
    );

  const byPath = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
  const out: Record<string, MediaView> = {};
  for (const r of rows) {
    const url = byPath.get(r.storage_path as string);
    if (url) {
      out[r.id as string] = {
        id: r.id as string,
        url,
        alt: (r.alt_text as string) ?? '',
        width: (r.width as number | null) ?? null,
        height: (r.height as number | null) ?? null,
      };
    }
  }
  return out;
}

/** Mantém a ordem pedida e descarta o que não está visível. */
export function orderedViews(ids: string[], views: Record<string, MediaView>): MediaView[] {
  return ids.map((id) => views[id]).filter((v): v is MediaView => Boolean(v));
}
