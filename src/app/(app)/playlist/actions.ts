'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseYouTubeId } from '@/lib/youtube';

export type TrackState = { error?: string; ok?: string } | undefined;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VISIBILITIES = ['private', 'friends', 'unlisted', 'public'];
const str = (form: FormData, key: string, max: number) => String(form.get(key) ?? '').trim().slice(0, max);
const uuid = (form: FormData, key: string) => {
  const v = String(form.get(key) ?? '');
  return UUID_RE.test(v) ? v : null;
};

export async function createPlaylist(form: FormData) {
  const title = str(form, 'title', 120);
  if (!title) redirect('/criar/playlist?erro=titulo');
  const visibility = String(form.get('visibility') ?? 'private');

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
  redirect(`/playlist/${data.id}`);
}

/** Adiciona uma faixa a partir de um link. O título vem do oEmbed público do YouTube. */
export async function addTrack(_prev: TrackState, form: FormData): Promise<TrackState> {
  const playlistId = uuid(form, 'playlistId');
  if (!playlistId) return { error: 'Playlist inválida.' };
  const videoId = parseYouTubeId(str(form, 'url', 500));
  if (!videoId) return { error: 'Cole um link do YouTube válido (youtube.com/watch?v=… ou youtu.be/…).' };

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
  const { data: last } = await supabase
    .from('playlist_tracks')
    .select('position')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('playlist_tracks').insert({
    playlist_id: playlistId,
    youtube_id: videoId,
    title: title || 'Vídeo do YouTube',
    author,
    position: (last?.position ?? -1) + 1,
  });
  if (error) {
    console.error('[addTrack]', error.code, error.message);
    return { error: error.message.includes('limite') ? 'A playlist atingiu o limite de 200 faixas.' : 'Não foi possível adicionar.' };
  }
  revalidatePath(`/playlist/${playlistId}`);
  return { ok: title ? `“${title}” adicionada.` : 'Faixa adicionada.' };
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
