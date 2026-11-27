import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Window } from '@/components/Window';
import { Notice } from '@/components/Notice';
import { Icon } from '@/components/Icon';
import { PlaylistPlayer, type Track } from '@/components/PlaylistPlayer';
import { createClient } from '@/lib/supabase/server';
import { deletePlaylist, moveTrack, removeTrack, updatePlaylist } from '../actions';
import { AddTrackForm } from './AddTrackForm';
import { PlaylistCover } from './PlaylistCover';
import { getMediaViews } from '@/lib/media';
import { autoCover } from '@/lib/playlistCover';

export const metadata: Metadata = { title: 'Playlist' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlaylistPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const importadas = Number(Array.isArray(sp.importadas) ? sp.importadas[0] : sp.importadas) || 0;
  const ignoradas = Number(Array.isArray(sp.ignoradas) ? sp.ignoradas[0] : sp.ignoradas) || 0;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: playlist } = await supabase
    .from('playlists')
    .select('id, owner_id, title, description, visibility, cover_media_id')
    .eq('id', id)
    .maybeSingle();
  if (!playlist) notFound();

  const { data: rows } = await supabase
    .from('playlist_tracks')
    .select('id, youtube_id, title, author, source, spotify_kind, spotify_id, cover_url')
    .eq('playlist_id', id)
    .order('position', { ascending: true });
  const tracks = (rows ?? []) as Track[];
  const isOwner = playlist.owner_id === auth.user?.id;
  const coverId = (playlist.cover_media_id as string | null) ?? null;
  const coverViews = coverId ? await getMediaViews(supabase, [coverId]) : {};
  const custom = coverId && coverViews[coverId] ? { id: coverId, url: coverViews[coverId].url } : null;
  const auto = autoCover(tracks[0]);
  const coverUrl = custom?.url ?? auto;

  return (
    <main id="conteudo" className="page page--wide">
      <Window title={playlist.title} icon="music" headingLevel={1}>
        <div className="stack">
          {importadas > 0 && (
            <Notice
              ok={`${importadas} faixas importadas.${ignoradas ? ` ${ignoradas} ficaram de fora (privadas, removidas ou acima do limite).` : ''}`}
            />
          )}
          <div className="playlist-head">
            <span className="playlist-cover" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {coverUrl ? <img src={coverUrl} alt="" /> : <span>♪</span>}
            </span>
            <div className="stack" style={{ gap: 4 }}>
              <p className="playlist-head__count muted" style={{ margin: 0 }}>
                Playlist · {tracks.length === 1 ? '1 item' : `${tracks.length} itens`}
              </p>
              {playlist.description && <p style={{ margin: 0 }}>{playlist.description}</p>}
            </div>
          </div>
          <PlaylistPlayer tracks={tracks} title={playlist.title} />
          <p className="muted" style={{ margin: 0, fontSize: '0.8125rem' }}>
            Nada toca sozinho. Ao escolher uma faixa, as seguintes tocam em sequência no miniplayer.
          </p>
        </div>
      </Window>

      {isOwner && (
        <>
          <Window title="Adicionar músicas" icon="plus">
            <AddTrackForm playlistId={playlist.id} />
          </Window>

          {tracks.length > 0 && (
            <Window title="Organizar faixas" icon="list">
              <ol className="track-rows">
                {tracks.map((t, i) => (
                  <li key={t.id} className="track-row">
                    <span className="track-row__text">
                      <span className="track-row__num">{i + 1}.</span>
                      <span>
                        <strong>{t.title}</strong>
                        {t.source === 'spotify' ? (
                          <span className="track-row__author">Spotify</span>
                        ) : (
                          t.author && <span className="track-row__author">{t.author.replace(/ - Topic$/, '')}</span>
                        )}
                      </span>
                    </span>
                    <span className="track-row__actions">
                      <form action={moveTrack} className="track-row__form">
                        <input type="hidden" name="playlistId" value={playlist.id} />
                        <input type="hidden" name="trackId" value={t.id} />
                        <button
                          type="submit"
                          name="dir"
                          value="up"
                          className="track-row__btn"
                          disabled={i === 0}
                          aria-label={`Subir ${t.title}`}
                        >
                          ↑
                        </button>
                        <button
                          type="submit"
                          name="dir"
                          value="down"
                          className="track-row__btn"
                          disabled={i === tracks.length - 1}
                          aria-label={`Descer ${t.title}`}
                        >
                          ↓
                        </button>
                      </form>
                      <form action={removeTrack} className="track-row__form">
                        <input type="hidden" name="playlistId" value={playlist.id} />
                        <input type="hidden" name="trackId" value={t.id} />
                        <button type="submit" className="track-row__btn track-row__btn--remove" aria-label={`Remover ${t.title}`}>
                          <Icon name="trash" />
                        </button>
                      </form>
                    </span>
                  </li>
                ))}
              </ol>
            </Window>
          )}

          <Window title="Capa" icon="image">
            <PlaylistCover playlistId={playlist.id} custom={custom} auto={auto} />
          </Window>

          <Window title="Ajustes da playlist" icon="gear">
            <div className="stack">
              <form action={updatePlaylist} className="stack">
                <input type="hidden" name="playlistId" value={playlist.id} />
                <div className="row" style={{ alignItems: 'flex-end' }}>
                  <div className="field" style={{ flex: '1 1 240px' }}>
                    <label htmlFor="pl-title">Nome</label>
                    <input id="pl-title" name="title" type="text" maxLength={120} defaultValue={playlist.title} />
                  </div>
                  <div className="field" style={{ flex: '0 1 200px' }}>
                    <label htmlFor="pl-vis">Quem pode ver</label>
                    <select id="pl-vis" name="visibility" defaultValue={playlist.visibility}>
                      <option value="private">Só eu</option>
                      <option value="friends">Amigos</option>
                      <option value="unlisted">Quem tiver o link</option>
                      <option value="public">Público</option>
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="pl-desc">Descrição</label>
                  <input id="pl-desc" name="description" type="text" maxLength={500} defaultValue={playlist.description} />
                </div>
                <div>
                  <button type="submit" className="btn">
                    Salvar
                  </button>
                </div>
              </form>
              <form action={deletePlaylist}>
                <input type="hidden" name="playlistId" value={playlist.id} />
                <button type="submit" className="btn btn--danger">
                  Excluir playlist
                </button>
              </form>
            </div>
          </Window>
        </>
      )}
    </main>
  );
}
