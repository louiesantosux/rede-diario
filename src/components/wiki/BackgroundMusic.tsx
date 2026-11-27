'use client';

import { useMusic } from '@/components/music/MusicProvider';
import { BG_MUSIC_MAX_VOLUME } from '@/lib/pageSettings';

/**
 * Música de fundo da página. Não começa sozinha (navegadores bloqueiam som
 * automático e o site evita estímulos não pedidos): o visitante escolhe tocar.
 * O volume fica limitado a 20% do volume do dispositivo.
 */
export function BackgroundMusic({ youtubeId, title, pageTitle }: { youtubeId: string; title: string; pageTitle: string }) {
  const music = useMusic();
  const playing = music.current?.youtube_id === youtubeId && music.status === 'playing';

  return (
    <div className="bg-music" role="group" aria-label="Música de fundo">
      <span aria-hidden="true">♪</span>
      <span>
        Música de fundo: <span className="bg-music__title">{title}</span>
      </span>
      {!playing && (
        <button
          type="button"
          className="btn"
          onClick={() =>
            music.playQueue(
              [{ id: `bg-${youtubeId}`, youtube_id: youtubeId, title, author: '' }],
              0,
              `Fundo de “${pageTitle}”`,
              { maxVolume: BG_MUSIC_MAX_VOLUME, loop: true },
            )
          }
        >
          {'▶︎'} Tocar
        </button>
      )}
      <span className="muted" style={{ fontSize: '0.8125rem' }}>
        Volume máximo de {BG_MUSIC_MAX_VOLUME}%
      </span>
    </div>
  );
}
