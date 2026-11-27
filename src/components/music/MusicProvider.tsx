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
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  getVolume(): number;
  getCurrentTime(): number;
  getDuration(): number;
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
  playQueue: (tracks: Track[], start: number, title: string, options?: PlayOptions) => void;
};

/** maxVolume: teto de volume (0–100, relativo ao volume do dispositivo). loop: repete a fila. */
export type PlayOptions = { maxVolume?: number; loop?: boolean };

const MusicContext = createContext<MusicContextValue | null>(null);

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic precisa estar dentro de <MusicProvider>');
  return ctx;
}

/**
 * Mantém um único player do YouTube vivo enquanto a pessoa navega pelo site.
 * O miniplayer mostra só a barra de reprodução; o vídeo fica oculto.
 * Atenção: as Políticas para Desenvolvedores do YouTube exigem o player visível
 * (mínimo de 200 × 200 px). Para voltar a exibir o vídeo, mude SHOW_VIDEO para true.
 */
const SHOW_VIDEO = false;

const formatTime = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};
export function MusicProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [minimized, setMinimized] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [maxVolume, setMaxVolume] = useState(100);
  const [volume, setVolume] = useState(100);
  const [loop, setLoop] = useState(false);
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const maxVolumeRef = useRef(100);
  const volumeRef = useRef(100);
  const loopRef = useRef(false);
  maxVolumeRef.current = maxVolume;
  volumeRef.current = volume;
  loopRef.current = loop;
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
          onReady: (e) => {
            e.target.setVolume(Math.min(volumeRef.current, maxVolumeRef.current));
            e.target.playVideo();
          },
          onStateChange: (e) => {
            if (e.data === 1) {
              setStatus('playing');
              e.target.setVolume(Math.min(volumeRef.current, maxVolumeRef.current));
            } else if (e.data === 2) setStatus('paused');
            else if (e.data === 0) {
              const next = indexRef.current + 1;
              if (next < queueRef.current.length) goTo(next);
              else if (loopRef.current) goTo(0);
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
    (tracks: Track[], start: number, playlistTitle: string, options: PlayOptions = {}) => {
      if (tracks.length === 0) return;
      const cap = Math.min(100, Math.max(0, options.maxVolume ?? 100));
      setMaxVolume(cap);
      maxVolumeRef.current = cap;
      setVolume(cap);
      volumeRef.current = cap;
      setLoop(Boolean(options.loop));
      loopRef.current = Boolean(options.loop);
      player.current?.setVolume(cap);
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

  const minimize = () => setMinimized(true);
  const restore = () => setMinimized(false);

  const close = () => {
    player.current?.destroy();
    player.current = null;
    holder.current?.replaceChildren();
    setQueue([]);
    setStatus('idle');
    setMinimized(false);
  };

  useEffect(() => () => player.current?.destroy(), []);

  // Mantém o volume dentro do teto, mesmo se alguém mexer no controle do próprio YouTube.
  useEffect(() => {
    if (maxVolume >= 100 || status !== 'playing') return;
    const timer = setInterval(() => {
      const p = player.current;
      if (p && p.getVolume() > maxVolumeRef.current) p.setVolume(maxVolumeRef.current);
    }, 500);
    return () => clearInterval(timer);
  }, [maxVolume, status]);

  // Atualiza a barra de progresso enquanto toca.
  useEffect(() => {
    if (status !== 'playing') return;
    const timer = setInterval(() => {
      const p = player.current;
      if (p) setTime({ current: p.getCurrentTime(), duration: p.getDuration() });
    }, 500);
    return () => clearInterval(timer);
  }, [status]);

  const seek = (seconds: number) => {
    player.current?.seekTo(seconds, true);
    setTime((t) => ({ ...t, current: seconds }));
  };

  const changeVolume = (v: number) => {
    const next = Math.min(v, maxVolume);
    setVolume(next);
    player.current?.setVolume(next);
  };

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
              <>
                <button
                  type="button"
                  className="toolbar__btn"
                  onClick={toggle}
                  aria-label={status === 'playing' ? 'Pausar' : 'Tocar'}
                >
                  {status === 'playing' ? '⏸\uFE0E' : '▶\uFE0E'}
                </button>
                <button type="button" className="toolbar__btn" onClick={restore} aria-label="Expandir miniplayer">
                  <Icon name="window" />
                </button>
              </>
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
                <button type="button" className="toolbar__btn" onClick={minimize} aria-label="Minimizar">
                  <Icon name="window" />
                </button>
              </>
            )}
            <button type="button" className="toolbar__btn" onClick={close} aria-label="Fechar miniplayer">
              ✕
            </button>
          </div>
        </div>
        {!minimized && (
          <div className="miniplayer__progress">
            <output>{formatTime(time.current)}</output>
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.floor(time.duration))}
              step={1}
              value={Math.min(Math.floor(time.current), Math.max(1, Math.floor(time.duration)))}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Posição da música"
              aria-valuetext={`${formatTime(time.current)} de ${formatTime(time.duration)}`}
            />
            <output>{formatTime(time.duration)}</output>
          </div>
        )}
        {!minimized && (
          <div className="miniplayer__volume">
            <label htmlFor="mini-volume">Volume</label>
            <input
              id="mini-volume"
              type="range"
              min={0}
              max={maxVolume}
              step={1}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-valuetext={`${volume}%`}
            />
            <output htmlFor="mini-volume">
              {volume}%{maxVolume < 100 ? ` (máx. ${maxVolume}%)` : ''}
            </output>
          </div>
        )}
        <div className={SHOW_VIDEO ? 'miniplayer__screen' : 'miniplayer__screen miniplayer__screen--hidden'} ref={holder} />
        {notice && (
          <p className="miniplayer__notice" role="status">
            {notice}
          </p>
        )}
      </section>
    </MusicContext.Provider>
  );
}
