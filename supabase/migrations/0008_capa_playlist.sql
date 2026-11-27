-- =====================================================================
-- Etapa 9: capa das playlists (escolhida pelo dono; sem ela, a capa da
-- primeira faixa é usada automaticamente). Pode ser executado mais de uma vez.
-- =====================================================================

alter table public.playlists
  add column if not exists cover_media_id uuid references public.media (id) on delete set null;

-- A capa precisa ser uma imagem do próprio dono
create or replace function public.check_playlist_cover()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.cover_media_id is not null
     and (tg_op = 'INSERT' or new.cover_media_id is distinct from old.cover_media_id)
     and not public.owns_all_media(new.owner_id, array[new.cover_media_id]) then
    raise exception 'Imagem não pertence ao dono da playlist';
  end if;
  return new;
end;
$$;
drop trigger if exists playlists_cover_check on public.playlists;
create trigger playlists_cover_check
  before insert or update of cover_media_id on public.playlists
  for each row execute function public.check_playlist_cover();

-- Quem pode ver a playlist pode ver a capa dela
create or replace function public.media_visible(mid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.media m where m.id = mid and m.owner_id = auth.uid())
    or exists (
      select 1 from public.posts p
      where mid = any (p.media_ids) and public.can_view(p.author_id, p.visibility)
    )
    or exists (
      select 1 from public.moodboards mb
      where mid = any (mb.media_ids) and public.can_view(mb.owner_id, mb.visibility)
    )
    or exists (
      select 1 from public.page_media pm
      join public.pages pg on pg.id = pm.page_id
      join public.wikis w on w.id = pg.wiki_id
      where pm.media_id = mid
        and public.can_view(pg.owner_id, pg.visibility)
        and public.can_view(w.owner_id, w.visibility)
    )
    or exists (
      select 1 from public.spaces s
      join public.profiles p on p.id = s.owner_id
      where mid in (s.avatar_media_id, s.bg_media_id)
        and public.can_view(s.owner_id, p.profile_visibility)
    )
    or exists (
      select 1 from public.spaces s
      where mid = any (s.about_media_ids)
        and public.space_module_visible(s.owner_id, 'sobre')
    )
    or exists (
      select 1 from public.playlists pl
      where pl.cover_media_id = mid and public.can_view(pl.owner_id, pl.visibility)
    );
$$;

-- Primeira faixa de cada playlist (para a capa automática). Respeita a RLS.
create or replace function public.playlist_first_tracks(ids uuid[])
returns table (playlist_id uuid, source text, youtube_id text, cover_url text)
language sql
stable
set search_path = ''
as $$
  select distinct on (t.playlist_id) t.playlist_id, t.source, t.youtube_id, t.cover_url
  from public.playlist_tracks t
  where t.playlist_id = any (ids)
  order by t.playlist_id, t.position, t.added_at;
$$;
