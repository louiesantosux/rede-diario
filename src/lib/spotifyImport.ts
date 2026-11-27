import 'server-only';
import { SPOTIFY_KIND_LABEL, isSpotifyImage, isSpotifyShortLink, parseSpotify, spotifyUrl, type SpotifyRef } from './spotify';

export type SpotifyItem =
  | { ok: true; ref: SpotifyRef; title: string; cover: string | null }
  | { ok: false; error: string };

/** Resolve links curtos (spotify.link) seguindo o redirecionamento até open.spotify.com. */
async function resolveShortLink(input: string): Promise<string | null> {
  try {
    const url = input.startsWith('http') ? input : `https://${input}`;
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(5000), cache: 'no-store' });
    return res.url || null;
  } catch {
    return null;
  }
}

/** Nome e capa quadrada pelo oEmbed público do Spotify (não precisa de chave). */
export async function fetchSpotifyItem(input: string): Promise<SpotifyItem> {
  let ref = parseSpotify(input);
  if (!ref && isSpotifyShortLink(input)) {
    const finalUrl = await resolveShortLink(input.trim());
    ref = finalUrl ? parseSpotify(finalUrl) : null;
  }
  if (!ref) {
    return { ok: false, error: 'Link do Spotify não reconhecido. Use o link de uma música, álbum ou playlist.' };
  }

  let title = '';
  let cover: string | null = null;
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl(ref))}`, {
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });
    if (res.status === 404) {
      return { ok: false, error: 'Não encontramos este item no Spotify. Ele pode ser privado ou ter sido removido.' };
    }
    if (res.ok) {
      const info = (await res.json()) as { title?: string; thumbnail_url?: string };
      title = (info.title ?? '').trim().slice(0, 200);
      cover = isSpotifyImage(info.thumbnail_url) ? info.thumbnail_url : null;
    } else {
      console.error('[spotifyImport] oembed', res.status);
    }
  } catch (e) {
    console.error('[spotifyImport]', e instanceof Error ? e.message : e);
  }
  return { ok: true, ref, title: title || SPOTIFY_KIND_LABEL[ref.kind], cover };
}

export const looksLikeSpotify = (input: string) =>
  /spotify\.com|spotify\.link|^spotify:/i.test(input.trim());
