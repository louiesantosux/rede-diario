'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parsePlaylistId, parseYouTubeId } from '@/lib/youtube';
import { fetchYouTubePlaylist } from '@/lib/youtubeImport';
import { fetchSpotifyItem, looksLikeSpotify } from '@/lib/spotifyImport';
import { SPOTIFY_KIND_LABEL } from '@/lib/spotify';

const MAX_TRACKS = 200;

export type TrackState = { error?: string; ok?: string } | undefined;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VISIBILITIES = ['private', 'friends', 'unlisted', 'public'];
const str = (form: FormData, key: string, max: number) => String(form.get(key) ?? '').trim().slice(0, max);
const uuid = (form: FormData, key: string) => {
  const v = String(form.get(key) ?? '');
  return UUID_RE.test(v) ? v : null;
};

export async function createPlaylist(form: FormData) {
  let title = str(form, 'title', 120);
  const importUrl = str(form, 'importUrl', 500);
  const visibility = String(form.get('visibility') ?? 'private');

  // Importação opcional de uma playlist pronta do YouTube / YouTube Music.
  let imported: Awaited<ReturnType<typeof fetchYouTubePlaylist>> | null = null;
  let spotify: Awaited<ReturnType<typeof fetchSpotifyItem>> | null = null;
  if (importUrl && looksLikeSpotify(importUrl)) {
    spotify = await fetchSpotifyItem(importUrl);
    if (!spotify.ok) redirect(`/criar/playlist?erro=importacao&detalhe=${encodeURIComponent(spotify.error)}`);
    if (!title) title = spotify.title;
  } else if (importUrl) {
    const listId = parsePlaylistId(importUrl);
    if (!listId) redirect('/criar/playlist?erro=link');
    imported = await fetchYouTubePlaylist(listId, MAX_TRACKS);
    if (!imported.ok) redirect(`/criar/playlist?erro=importacao&detalhe=${encodeURIComponent(imported.error)}`);
    if (!title) title = imported.title;
  }
  if (!title) redirect('/criar/playlist?erro=titulo');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('playlists')
    .insert({
      title,
      description: str(form, 'description', 500),
      visibility: VISIBILITIES.includes(visibility) ? visibility : 'private',
    })
    .select('id')
    .single();
  if (error || !data) {
    console.error('[createPlaylist]', error?.code, error?.message);
    redirect('/criar/playlist?erro=falhou');
  }

  if (spotify?.ok) {
    const { error: spError } = await supabase.from('playlist_tracks').insert(spotifyRow(spotify, data.id, 0));
    if (spError) console.error('[createPlaylist/spotify]', spError.code, spError.message);
    redirect(`/playlist/${data.id}`);
  }

  if (imported?.ok && imported.tracks.length) {
    const { error: tracksError } = await supabase
      .from('playlist_tracks')
      .insert(imported.tracks.map((t, position) => ({ ...t, playlist_id: data.id, position })));
    if (tracksError) console.error('[createPlaylist/import]', tracksError.code, tracksError.message);
    redirect(`/playlist/${data.id}?importadas=${imported.tracks.length}&ignoradas=${imported.skipped}`);
  }
  redirect(`/playlist/${data.id}`);
}

function spotifyRow(item: Extract<Awaited<ReturnType<typeof fetchSpotifyItem>>, { ok: true }>, playlistId: string, position: number) {
  return {
    playlist_id: playlistId,
    source: 'spotify',
    youtube_id: null,
    spotify_kind: item.ref.kind,
    spotify_id: item.ref.id,
    cover_url: item.cover,
    title: item.title,
    author: '',
    position,
  };
}

async function nextPosition(playlistId: string) {
  const supabase = await createClient();
  const { data: last } = await supabase
    .from('playlist_tracks')
    .select('position')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (last?.position ?? -1) + 1;
}

/** Adiciona uma faixa a partir de um link do YouTube ou do Spotify. */
export async function addTrack(_prev: TrackState, form: FormData): Promise<TrackState> {
  const playlistId = uuid(form, 'playlistId');
  if (!playlistId) return { error: 'Playlist inválida.' };
  const input = str(form, 'url', 500);

  // Spotify: faixa, álbum ou playlist entram como um item com capa e tocam no player do Spotify.
  if (looksLikeSpotify(input)) {
    const item = await fetchSpotifyItem(input);
    if (!item.ok) return { error: item.error };
    const supabase = await createClient();
    const { error } = await supabase.from('playlist_tracks').insert(spotifyRow(item, playlistId, await nextPosition(playlistId)));
    if (error) {
      console.error('[addTrack/spotify]', error.code, error.message);
      return { error: error.message.includes('limite') ? 'A playlist atingiu o limite de 200 faixas.' : 'Não foi possível adicionar.' };
    }
    revalidatePath(`/playlist/${playlistId}`);
    const kind = item.ref.kind === 'track' ? '' : ` (${SPOTIFY_KIND_LABEL[item.ref.kind].toLowerCase()})`;
    return { ok: `“${item.title}”${kind} adicionada.` };
  }

  const videoId = parseYouTubeId(input);

  // Link de playlist (sem vídeo específico): importa todas as faixas.
  if (!videoId) {
    const listId = parsePlaylistId(input);
    if (!listId) {
      return { error: 'Cole um link válido: música ou playlist do YouTube, ou música, álbum ou playlist do Spotify.' };
    }
    return importIntoPlaylist(playlistId, listId);
  }

  let title = '';
  let author = '';
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
      { signal: AbortSignal.timeout(5000), cache: 'no-store' },
    );
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return { error: 'Este vídeo é privado, foi removido ou não permite ser incorporado.' };
    }
    if (res.ok) {
      const info = (await res.json()) as { title?: string; author_name?: string };
      title = (info.title ?? '').slice(0, 200);
      author = (info.author_name ?? '').slice(0, 120);
    }
  } catch {
    // Sem resposta do YouTube: salva sem título; o player funciona do mesmo jeito.
  }

  const supabase = await createClient();
  const { error } = await supabase.from('playlist_tracks').insert({
    playlist_id: playlistId,
    youtube_id: videoId,
    title: title || 'Vídeo do YouTube',
    author,
    position: await nextPosition(playlistId),
  });
  if (error) {
    console.error('[addTrack]', error.code, error.message);
    return { error: error.message.includes('limite') ? 'A playlist atingiu o limite de 200 faixas.' : 'Não foi possível adicionar.' };
  }
  revalidatePath(`/playlist/${playlistId}`);
  return { ok: title ? `“${title}” adicionada.` : 'Faixa adicionada.' };
}

async function importIntoPlaylist(playlistId: string, listId: string): Promise<TrackState> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('playlist_tracks')
    .select('position')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: false });
  const existing = rows?.length ?? 0;
  const room = MAX_TRACKS - existing;
  if (room <= 0) return { error: 'A playlist já tem 200 faixas, o limite.' };

  const result = await fetchYouTubePlaylist(listId, room);
  if (!result.ok) return { error: result.error };
  if (result.tracks.length === 0) return { error: 'Nenhuma faixa disponível nesta playlist.' };

  const start = (rows?.[0]?.position ?? -1) + 1;
  const { error } = await supabase
    .from('playlist_tracks')
    .insert(result.tracks.map((t, i) => ({ ...t, playlist_id: playlistId, position: start + i })));
  if (error) {
    console.error('[importIntoPlaylist]', error.code, error.message);
    return { error: 'Não foi possível importar as faixas.' };
  }
  revalidatePath(`/playlist/${playlistId}`);
  const extra = result.skipped ? ` ${result.skipped} ficaram de fora (privadas, removidas ou acima do limite).` : '';
  return { ok: `${result.tracks.length} faixas de “${result.title}” adicionadas.${extra}` };
}

export async function moveTrack(form: FormData) {
  const playlistId = uuid(form, 'playlistId');
  const trackId = uuid(form, 'trackId');
  if (!playlistId || !trackId) redirect('/meu-espaco');
  const dir = form.get('dir') === 'up' ? -1 : 1;

  const supabase = await createClient();
  const { data: tracks } = await supabase
    .from('playlist_tracks')
    .select('id, position')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: true });
  const list = tracks ?? [];
  const i = list.findIndex((t) => t.id === trackId);
  const j = i + dir;
  if (i >= 0 && j >= 0 && j < list.length) {
    // Renumera tudo para manter posições contínuas.
    const order = list.map((t) => t.id as string);
    [order[i], order[j]] = [order[j], order[i]];
    await Promise.all(order.map((id, position) => supabase.from('playlist_tracks').update({ position }).eq('id', id)));
  }
  revalidatePath(`/playlist/${playlistId}`);
  redirect(`/playlist/${playlistId}`);
}

export async function removeTrack(form: FormData) {
  const playlistId = uuid(form, 'playlistId');
  const trackId = uuid(form, 'trackId');
  if (!playlistId || !trackId) redirect('/meu-espaco');
  const supabase = await createClient();
  await supabase.from('playlist_tracks').delete().eq('id', trackId);
  revalidatePath(`/playlist/${playlistId}`);
  redirect(`/playlist/${playlistId}`);
}

export async function updatePlaylist(form: FormData) {
  const id = uuid(form, 'playlistId');
  if (!id) redirect('/meu-espaco');
  const title = str(form, 'title', 120);
  const visibility = String(form.get('visibility') ?? '');
  const supabase = await createClient();
  await supabase
    .from('playlists')
    .update({
      ...(title ? { title } : {}),
      description: str(form, 'description', 500),
      ...(VISIBILITIES.includes(visibility) ? { visibility } : {}),
    })
    .eq('id', id);
  redirect(`/playlist/${id}`);
}

export async function deletePlaylist(form: FormData) {
  const id = uuid(form, 'playlistId');
  if (!id) redirect('/meu-espaco');
  const supabase = await createClient();
  await supabase.from('playlists').delete().eq('id', id);
  redirect('/meu-espaco?aviso=playlist-excluida');
}
