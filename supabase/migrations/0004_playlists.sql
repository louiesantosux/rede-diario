-- =====================================================================
-- Etapa 5: playlists com músicas do YouTube
-- =====================================================================

create table public.playlists (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  description  text not null default '' check (char_length(description) <= 500),
  visibility   public.visibility not null default 'private',
  share_token  uuid not null default gen_random_uuid() unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index playlists_owner_idx on public.playlists (owner_id);
create trigger playlists_updated_at before update on public.playlists
  for each row execute function public.set_updated_at();

create table public.playlist_tracks (
  id           uuid primary key default gen_random_uuid(),
  playlist_id  uuid not null references public.playlists (id) on delete cascade,
  youtube_id   text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  title        text not null default '' check (char_length(title) <= 200),
  author       text not null default '' check (char_length(author) <= 120),
  position     integer not null default 0,
  added_at     timestamptz not null default now()
);
create index playlist_tracks_order_idx on public.playlist_tracks (playlist_id, position);

-- Limite de 200 faixas por playlist
create or replace function public.check_playlist_size()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.playlist_tracks t where t.playlist_id = new.playlist_id) >= 200 then
    raise exception 'A playlist atingiu o limite de 200 faixas';
  end if;
  return new;
end;
$$;
create trigger playlist_tracks_size before insert on public.playlist_tracks
  for each row execute function public.check_playlist_size();

alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;

create policy "playlist: leitura" on public.playlists for select to authenticated
  using (public.can_view(owner_id, visibility));
create policy "playlist: dono escreve" on public.playlists for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "faixa: leitura" on public.playlist_tracks for select to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id));
create policy "faixa: dono escreve" on public.playlist_tracks for all to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = (select auth.uid())));

-- Playlist por link (não listada)
create or replace function public.shared_playlist(token uuid)
returns setof public.playlists
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.playlists p
  where p.share_token = token
    and p.visibility in ('unlisted', 'public')
    and (auth.uid() is null or not public.is_blocked(p.owner_id, auth.uid()));
$$;
