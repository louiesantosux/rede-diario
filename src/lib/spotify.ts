// Links do Spotify aceitos nas playlists. Sem API (que exige conta Premium do
// desenvolvedor e limita usuários): usamos o oEmbed público, que dá nome e capa,
// e o player oficial do Spotify para tocar.

export const SPOTIFY_KINDS = ['track', 'album', 'playlist'] as const;
export type SpotifyKind = (typeof SPOTIFY_KINDS)[number];
export type SpotifyRef = { kind: SpotifyKind; id: string };

const ID_RE = /^[A-Za-z0-9]{22}$/;
export const isSpotifyId = (v: unknown): v is string => typeof v === 'string' && ID_RE.test(v);

/** Aceita open.spotify.com (com ou sem /intl-xx/), play.spotify.com e URIs spotify:track:ID. */
export function parseSpotify(input: string): SpotifyRef | null {
  const raw = input.trim();
  const uri = /^spotify:(track|album|playlist):([A-Za-z0-9]{22})$/.exec(raw);
  if (uri) return { kind: uri[1] as SpotifyKind, id: uri[2] };

  let url: URL;
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!['open.spotify.com', 'play.spotify.com'].includes(url.hostname)) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  // /intl-pt/track/ID, /embed/track/ID, /track/ID
  const start = parts.findIndex((p) => (SPOTIFY_KINDS as readonly string[]).includes(p));
  if (start < 0) return null;
  const kind = parts[start] as SpotifyKind;
  const id = parts[start + 1];
  return isSpotifyId(id) ? { kind, id } : null;
}

export const isSpotifyShortLink = (input: string) => /^(https?:\/\/)?spotify\.link\/[A-Za-z0-9]+\/?$/.test(input.trim());

export const spotifyUri = (ref: SpotifyRef) => `spotify:${ref.kind}:${ref.id}`;
export const spotifyUrl = (ref: SpotifyRef) => `https://open.spotify.com/${ref.kind}/${ref.id}`;

/** Capas vêm só dos servidores de imagem do Spotify (ver CSP em next.config.ts). */
export const isSpotifyImage = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.length <= 500 &&
  /^https:\/\/(i\.scdn\.co|mosaic\.scdn\.co|image-cdn-[a-z0-9]+\.spotifycdn\.com)\/[A-Za-z0-9/._-]+$/.test(v);

export const SPOTIFY_KIND_LABEL: Record<SpotifyKind, string> = {
  track: 'Faixa do Spotify',
  album: 'Álbum do Spotify',
  playlist: 'Playlist do Spotify',
};
