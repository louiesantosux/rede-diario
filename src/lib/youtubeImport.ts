import 'server-only';

// Leitura de playlists do YouTube pela YouTube Data API v3 (só no servidor).
// Requer a variável de ambiente YOUTUBE_API_KEY.

export type ImportedTrack = { youtube_id: string; title: string; author: string };
export type ImportResult =
  | { ok: true; title: string; tracks: ImportedTrack[]; skipped: number }
  | { ok: false; error: string };

const API = 'https://www.googleapis.com/youtube/v3';

type ApiError = { error?: { code?: number; message?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] } };

/** Traduz o erro da API do Google para uma mensagem que diz o que ajustar. */
function explain(status: number, body: ApiError): string {
  const reasons = [
    ...(body.error?.errors ?? []).map((e) => e.reason ?? ''),
    ...(body.error?.details ?? []).map((d) => d.reason ?? ''),
  ].join(' ');
  const message = body.error?.message ?? '';
  console.error('[youtubeImport]', status, reasons, message);

  if (/API_KEY_INVALID|keyInvalid/i.test(reasons) || /API key not valid/i.test(message)) {
    return 'A chave YOUTUBE_API_KEY é inválida. Copie a chave de novo no Google Cloud, atualize na Vercel e faça o redeploy.';
  }
  if (/SERVICE_DISABLED|accessNotConfigured/i.test(reasons) || /has not been used|is disabled/i.test(message)) {
    return 'A YouTube Data API v3 não está ativada no projeto do Google Cloud. Ative em APIs e serviços → Biblioteca.';
  }
  if (/REFERRER|referer|IP_ADDRESS|API_KEY_SERVICE_BLOCKED/i.test(reasons + message)) {
    return 'A chave está com restrição que bloqueia o servidor. Em "Restrições de aplicativo", escolha "Nenhuma" e, em "Restrições de API", deixe só a YouTube Data API v3.';
  }
  if (/quota/i.test(reasons + message)) {
    return 'A cota diária da API do YouTube acabou. Tente de novo amanhã.';
  }
  if (status === 404 || /playlistNotFound/i.test(reasons)) {
    return 'Playlist não encontrada. Ela precisa ser pública ou não listada.';
  }
  return `O YouTube recusou a leitura (erro ${status}). Tente de novo mais tarde.`;
}

type ItemsResponse = {
  nextPageToken?: string;
  items?: {
    snippet?: { title?: string; videoOwnerChannelTitle?: string; resourceId?: { videoId?: string } };
    status?: { privacyStatus?: string };
  }[];
  error?: { code?: number; message?: string };
};

export async function fetchYouTubePlaylist(listId: string, limit: number): Promise<ImportResult> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: 'A importação de playlists ainda não foi configurada (falta a chave YOUTUBE_API_KEY).' };
  }
  if (/^RD/.test(listId)) {
    return { ok: false, error: 'Mixes automáticos do YouTube não podem ser importados. Use uma playlist criada por alguém.' };
  }

  try {
    const meta = await fetch(
      `${API}/playlists?part=snippet&id=${encodeURIComponent(listId)}&key=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(8000), cache: 'no-store' },
    );
    const metaJson = (await meta.json()) as { items?: { snippet?: { title?: string } }[] } & ApiError;
    if (!meta.ok) return { ok: false, error: explain(meta.status, metaJson) };
    const playlistTitle = metaJson.items?.[0]?.snippet?.title;
    if (!playlistTitle) {
      return { ok: false, error: 'Playlist não encontrada. Ela precisa ser pública ou não listada.' };
    }

    const tracks: ImportedTrack[] = [];
    let skipped = 0;
    let pageToken = '';
    for (let page = 0; page < 10 && tracks.length < limit; page++) {
      const res = await fetch(
        `${API}/playlistItems?part=snippet,status&maxResults=50&playlistId=${encodeURIComponent(listId)}&key=${encodeURIComponent(key)}${
          pageToken ? `&pageToken=${pageToken}` : ''
        }`,
        { signal: AbortSignal.timeout(8000), cache: 'no-store' },
      );
      const json = (await res.json()) as ItemsResponse & ApiError;
      if (!res.ok) return { ok: false, error: explain(res.status, json) };

      for (const item of json.items ?? []) {
        const id = item.snippet?.resourceId?.videoId;
        const privacy = item.status?.privacyStatus;
        if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id) || privacy === 'private' || privacy === 'privacyStatusUnspecified') {
          skipped++;
          continue;
        }
        if (tracks.length >= limit) {
          skipped++;
          continue;
        }
        tracks.push({
          youtube_id: id,
          title: (item.snippet?.title ?? 'Vídeo do YouTube').slice(0, 200),
          author: (item.snippet?.videoOwnerChannelTitle ?? '').replace(/ - Topic$/, '').slice(0, 120),
        });
      }
      if (!json.nextPageToken) break;
      pageToken = json.nextPageToken;
    }
    return { ok: true, title: playlistTitle.slice(0, 120), tracks, skipped };
  } catch (e) {
    console.error('[youtubeImport] falha de rede', e);
    return { ok: false, error: 'Não foi possível falar com o YouTube agora. Tente de novo.' };
  }
}
