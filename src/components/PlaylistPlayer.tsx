'use client';

import { useState } from 'react';
import { embedUrl, thumbUrl } from '@/lib/youtube';

export type Track = { id: string; youtube_id: string; title: string; author: string };

/**
 * Player oficial do YouTube (youtube-nocookie), sem reprodução automática.
 * Ao dar play, as faixas seguintes tocam em sequência.
 */
export function PlaylistPlayer({ tracks, title }: { tracks: Track[]; title: string }) {
  const [current, setCurrent] = useState(0);
  if (tracks.length === 0) return <p className="muted">Nenhuma faixa ainda.</p>;

  const ids = tracks.map((t) => t.youtube_id);
  const track = tracks[current] ?? tracks[0];
  const queue = [...ids.slice(current + 1), ...ids.slice(0, current)];

  return (
    <div className="player">
      <div className="player__screen">
        <iframe
          key={track.youtube_id}
          src={embedUrl(track.youtube_id, queue)}
          title={`Player: ${track.title} — ${title}`}
          allow="encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
        />
      </div>
      <ol className="tracklist" aria-label={`Faixas de ${title}`}>
        {tracks.map((t, i) => (
          <li key={t.id}>
            <button
              type="button"
              className="tracklist__item"
              aria-current={i === current ? 'true' : undefined}
              onClick={() => setCurrent(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbUrl(t.youtube_id)} alt="" width={64} height={36} loading="lazy" />
              <span className="tracklist__text">
                <span className="tracklist__title">{t.title}</span>
                {t.author && <span className="tracklist__author">{t.author}</span>}
              </span>
              {i === current && <span className="tracklist__now">Selecionada</span>}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
