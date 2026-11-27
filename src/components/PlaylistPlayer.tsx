'use client';

import { useMusic, type Track } from '@/components/music/MusicProvider';
import { thumbUrl } from '@/lib/youtube';

export type { Track };

/**
 * Lista de faixas que toca no miniplayer global: a música continua enquanto
 * a pessoa navega pelo site. Nada começa a tocar sem um clique.
 */
export function PlaylistPlayer({ tracks, title }: { tracks: Track[]; title: string }) {
  const music = useMusic();
  if (tracks.length === 0) return <p className="muted">Nenhuma faixa ainda.</p>;

  const isThisQueue = music.queue.length > 0 && music.queue[0]?.id === tracks[0]?.id && music.queue.length === tracks.length;

  return (
    <div className="player">
      <div className="row">
        <button type="button" className="btn btn--primary" onClick={() => music.playQueue(tracks, 0, title)}>
          ▶ Tocar playlist
        </button>
        <span className="muted" style={{ fontSize: '0.875rem' }}>
          Toca no miniplayer, que continua enquanto você navega.
        </span>
      </div>
      <ol className="tracklist" aria-label={`Faixas de ${title}`}>
        {tracks.map((t, i) => {
          const playing = isThisQueue && music.index === i && music.status !== 'idle';
          return (
            <li key={t.id}>
              <button
                type="button"
                className="tracklist__item"
                aria-current={playing ? 'true' : undefined}
                aria-label={`Tocar ${t.title}`}
                onClick={() => music.playQueue(tracks, i, title)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbUrl(t.youtube_id)} alt="" width={64} height={36} loading="lazy" />
                <span className="tracklist__text">
                  <span className="tracklist__title">{t.title}</span>
                  {t.author && <span className="tracklist__author">{t.author.replace(/ - Topic$/, '')}</span>}
                </span>
                {playing && <span className="tracklist__now">{music.status === 'playing' ? 'Tocando' : 'Pausada'}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
