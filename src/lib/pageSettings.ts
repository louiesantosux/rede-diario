import { isYouTubeId } from './youtube';

/** Configurações próprias de uma página de wiki (coluna pages.theme). */
export type PageSettings = {
  bgMusic: { youtubeId: string; title: string } | null;
};

/** Volume máximo da música de fundo, em % do volume do dispositivo. */
export const BG_MUSIC_MAX_VOLUME = 20;

export function sanitizePageSettings(raw: unknown): PageSettings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const m = (typeof r.bgMusic === 'object' && r.bgMusic !== null ? r.bgMusic : null) as Record<string, unknown> | null;
  return {
    bgMusic:
      m && isYouTubeId(m.youtubeId)
        ? { youtubeId: m.youtubeId, title: typeof m.title === 'string' ? m.title.slice(0, 200) : 'Música de fundo' }
        : null,
  };
}
