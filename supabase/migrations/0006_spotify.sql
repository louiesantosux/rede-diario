-- =====================================================================
-- Etapa 7: faixas do Spotify nas playlists (faixa, álbum ou playlist)
-- Pode ser executado mais de uma vez.
-- =====================================================================

alter table public.playlist_tracks add column if not exists source text not null default 'youtube';
alter table public.playlist_tracks add column if not exists spotify_kind text;
alter table public.playlist_tracks add column if not exists spotify_id text;
alter table public.playlist_tracks add column if not exists cover_url text;
alter table public.playlist_tracks alter column youtube_id drop not null;

alter table public.playlist_tracks drop constraint if exists playlist_tracks_source_check;
alter table public.playlist_tracks add constraint playlist_tracks_source_check check (
  (source = 'youtube' and youtube_id is not null and spotify_id is null and spotify_kind is null)
  or (
    source = 'spotify'
    and youtube_id is null
    and spotify_kind in ('track', 'album', 'playlist')
    and spotify_id ~ '^[A-Za-z0-9]{22}$'
  )
);

-- Capa: só imagens dos servidores do Spotify
alter table public.playlist_tracks drop constraint if exists playlist_tracks_cover_check;
alter table public.playlist_tracks add constraint playlist_tracks_cover_check check (
  cover_url is null
  or (
    char_length(cover_url) <= 500
    and cover_url ~ '^https://(i\.scdn\.co|mosaic\.scdn\.co|image-cdn-[a-z0-9]+\.spotifycdn\.com)/[A-Za-z0-9/._-]+$'
  )
);
