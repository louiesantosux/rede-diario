'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import { thumbUrl } from '@/lib/youtube';

export type Track = { id: string; youtube_id: string; title: string; author: string };

// ---------- Tipos mínimos da YouTube IFrame API ----------
type YTPlayer = {
  loadVideoById(id: string): void;
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
};
type YTEvent = { data: number; target: YTPlayer };
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      host?: string;
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: { onReady?: (e: YTEvent) => void; onStateChange?: (e: YTEvent) => void; onError?: (e: YTEvent) => void };
    },
  ) => YTPlayer;
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  });
  return apiPromise;
}

// ---------- Contexto ----------
type Status = 'idle' | 'loading' | 'playing' | 'paused';

type MusicContextValue = {
  queue: Track[];
  index: number;
  status: Status;
  current: Track | null;
  playQueue: (tracks: Track[], start: number, title: string) => void;
};

const MusicContext = createContext<MusicContextValue | null>(null);

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic precisa estar dentro de <MusicProvider>');
  return ctx;
}

/**
 * Mantém um único player do YouTube vivo enquanto a pessoa navega pelo site,
 * exibido no miniplayer. Pelas regras do YouTube o vídeo fica sempre visível
 * (mínimo de 200 px) enquanto toca; ao minimizar, a música pausa.
 */
export function MusicProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [minimized, setMinimized] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const queueRef = useRef<Track[]>([]);
  const indexRef = useRef(0);
  queueRef.current = queue;
  indexRef.current = index;

  const current = queue[index] ?? null;

  const goTo = useCallback((i: number) => {
    const list = queueRef.current;
    if (i < 0 || i >= list.length) return;
    setIndex(i);
    setNotice(null);
    setStatus('loading');
    player.current?.loadVideoById(list[i].youtube_id);
  }, []);

  const ensurePlayer = useCallback(
    async (videoId: string) => {
      await loadYouTubeApi();
      if (player.current) {
        player.current.loadVideoById(videoId);
        return;
      }
      // Espera o miniplayer aparecer na tela antes de criar o player.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (!holder.current || !window.YT) return;
      const mount = document.createElement('div');
      holder.current.replaceChildren(mount);
      player.current = new window.YT.Player(mount, {
        host: 'https://www.youtube-nocookie.com',
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { rel: 0, playsinline: 1, modestbranding: 1 },
        events: {
          onReady: (e) => e.target.playVideo(),
          onStateChange: (e) => {
            if (e.data === 1) setStatus('playing');
            else if (e.data === 2) setStatus('paused');
            else if (e.data === 0) {
              const next = indexRef.current + 1;
              if (next < queueRef.current.length) goTo(next);
              else setStatus('paused');
            }
          },
          onError: () => {
            setNotice('Este vídeo não pode ser reproduzido aqui. Pulando para a próxima.');
            const next = indexRef.current + 1;
            if (next < queueRef.current.length) goTo(next);
            else setStatus('paused');
          },
        },
      });
    },
    [goTo],
  );

  const playQueue = useCallback(
    (tracks: Track[], start: number, playlistTitle: string) => {
      if (tracks.length === 0) return;
      const i = Math.min(Math.max(0, start), tracks.length - 1);
      setQueue(tracks);
      queueRef.current = tracks;
      setIndex(i);
      indexRef.current = i;
      setTitle(playlistTitle);
      setMinimized(false);
      setNotice(null);
      setStatus('loading');
      void ensurePlayer(tracks[i].youtube_id);
    },
    [ensurePlayer],
  );

  const toggle = () => {
    if (!player.current) return;
    if (status === 'playing') player.current.pauseVideo();
    else player.current.playVideo();
  };

  const minimize = () => {
    player.current?.pauseVideo();
    setMinimized(true);
  };

  const restore = () => {
    setMinimized(false);
    player.current?.playVideo();
  };

  const close = () => {
    player.current?.destroy();
    player.current = null;
    holder.current?.replaceChildren();
    setQueue([]);
    setStatus('idle');
    setMinimized(false);
  };

  useEffect(() => () => player.current?.destroy(), []);

  const value = useMemo<MusicContextValue>(
    () => ({ queue, index, status, current, playQueue }),
    [queue, index, status, current, playQueue],
  );

  const active = queue.length > 0;

  return (
    <MusicContext.Provider value={value}>
      {children}
      <section
        className={`miniplayer${active ? '' : ' miniplayer--hidden'}${minimized ? ' miniplayer--min' : ''}`}
        aria-label="Miniplayer de música"
        aria-hidden={!active}
      >
        <div className="miniplayer__bar">
          {current && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbUrl(current.youtube_id)} alt="" width={48} height={27} className="miniplayer__thumb" />
          )}
          <div className="miniplayer__info">
            <span className="miniplayer__title">{current?.title ?? ''}</span>
            <span className="miniplayer__sub">
              {title}
              {queue.length > 1 ? ` · ${index + 1} de ${queue.length}` : ''}
            </span>
          </div>
          <div className="miniplayer__controls">
            {minimized ? (
              <button type="button" className="toolbar__btn" onClick={restore} aria-label="Abrir miniplayer e continuar">
                {'▶\uFE0E'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="toolbar__btn"
                  onClick={() => goTo(index - 1)}
                  disabled={index === 0}
                  aria-label="Faixa anterior"
                >
                  {'⏮\uFE0E'}
                </button>
                <button
                  type="button"
                  className="toolbar__btn"
                  onClick={toggle}
                  aria-label={status === 'playing' ? 'Pausar' : 'Tocar'}
                >
                  {status === 'playing' ? '⏸\uFE0E' : '▶\uFE0E'}
                </button>
                <button
                  type="button"
                  className="toolbar__btn"
                  onClick={() => goTo(index + 1)}
                  disabled={index >= queue.length - 1}
                  aria-label="Próxima faixa"
                >
                  {'⏭\uFE0E'}
                </button>
                <button type="button" className="toolbar__btn" onClick={minimize} aria-label="Minimizar (pausa a música)">
                  <Icon name="window" />
                </button>
              </>
            )}
            <button type="button" className="toolbar__btn" onClick={close} aria-label="Fechar miniplayer">
              ✕
            </button>
          </div>
        </div>
        <div className="miniplayer__screen" ref={holder} />
        {notice && (
          <p className="miniplayer__notice" role="status">
            {notice}
          </p>
        )}
      </section>
    </MusicContext.Provider>
  );
}
