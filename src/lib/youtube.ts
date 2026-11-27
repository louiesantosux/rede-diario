const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtube-nocookie.com']);

/** Extrai o ID de 11 caracteres de um link do YouTube (ou aceita o próprio ID). */
export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (ID_RE.test(value)) return value;
  let url: URL;
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (!HOSTS.has(url.hostname)) return null;
  if (url.hostname === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return ID_RE.test(id) ? id : null;
  }
  const v = url.searchParams.get('v');
  if (v && ID_RE.test(v)) return v;
  const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

export const isYouTubeId = (v: unknown): v is string => typeof v === 'string' && ID_RE.test(v);

/** Player oficial em modo de privacidade aprimorada, sem reprodução automática. */
export function embedUrl(current: string, queue: string[] = []) {
  const params = new URLSearchParams({ rel: '0', modestbranding: '1' });
  const rest = queue.filter((id) => id !== current && isYouTubeId(id)).slice(0, 50);
  if (rest.length) params.set('playlist', rest.join(','));
  return `https://www.youtube-nocookie.com/embed/${current}?${params.toString()}`;
}

export const thumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

const LIST_RE = /^[A-Za-z0-9_-]{10,64}$/;

/** Extrai o id de uma playlist (youtube.com ou music.youtube.com, parâmetro list=). */
export function parsePlaylistId(input: string): string | null {
  const value = input.trim();
  let url: URL;
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`);
  } catch {
    return LIST_RE.test(value) && /^(PL|OLAK5uy_|UU|FL)/.test(value) ? value : null;
  }
  if (!HOSTS.has(url.hostname)) return null;
  const list = url.searchParams.get('list');
  return list && LIST_RE.test(list) ? list : null;
}
