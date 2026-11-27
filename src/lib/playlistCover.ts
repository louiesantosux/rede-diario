import { thumbUrl } from './youtube';

type FirstTrack = { source?: string | null; youtube_id?: string | null; cover_url?: string | null } | null | undefined;

/** Capa automática: a capa da primeira faixa (Spotify) ou a miniatura do primeiro vídeo (YouTube). */
export function autoCover(t: FirstTrack): string | null {
  if (!t) return null;
  if (t.source === 'spotify') return t.cover_url ?? null;
  return t.youtube_id ? thumbUrl(t.youtube_id) : null;
}
