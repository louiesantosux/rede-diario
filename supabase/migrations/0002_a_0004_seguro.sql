-- =====================================================================
-- Migrações 0002 a 0004 em um único script, seguro para rodar mais de uma vez.
-- Pré-requisito: 0001_init.sql já executado (ele NÃO deve ser rodado de novo).
-- =====================================================================

-- =====================================================================
-- Etapa 3: imagens, moodboards e imagens em posts e páginas
-- Regra central: uma imagem só é visível para quem pode ver algum
-- conteúdo que a usa (post, moodboard ou página de wiki), além do dono.
-- =====================================================================

alter table public.media add column if not exists original_path text;

-- Imagens anexadas a posts
alter table public.posts add column if not exists media_ids uuid[] not null default '{}';

-- Moodboards
create table if not exists public.moodboards (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  description  text not null default '',
  layout       text not null default 'mosaico' check (layout in ('grade', 'mosaico')),
  media_ids    uuid[] not null default '{}',
  visibility   public.visibility not null default 'private',
  share_token  uuid not null default gen_random_uuid() unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint moodboard_size check (cardinality(media_ids) <= 60)
);
create index if not exists moodboards_owner_idx on public.moodboards (owner_id);
drop trigger if exists moodboards_updated_at on public.moodboards;
create trigger moodboards_updated_at before update on public.moodboards
  for each row execute function public.set_updated_at();

-- Imagens usadas em páginas de wiki (mantida pelo app ao salvar a página)
create table if not exists public.page_media (
  page_id   uuid not null references public.pages (id) on delete cascade,
  media_id  uuid not null references public.media (id) on delete cascade,
  primary key (page_id, media_id)
);

-- ---------------------------------------------------------------------
-- Integridade: só é possível anexar imagens próprias
-- ---------------------------------------------------------------------
create or replace function public.owns_all_media(owner uuid, ids uuid[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from unnest(coalesce(ids, '{}')) as mid
    where not exists (select 1 from public.media m where m.id = mid and m.owner_id = owner)
  );
$$;

create or replace function public.check_post_media()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if cardinality(new.media_ids) > 20 then
    raise exception 'Um post pode ter no máximo 20 imagens';
  end if;
  if not public.owns_all_media(new.author_id, new.media_ids) then
    raise exception 'Imagem não pertence ao autor';
  end if;
  return new;
end;
$$;
drop trigger if exists posts_media_check on public.posts;
create trigger posts_media_check before insert or update of media_ids on public.posts
  for each row execute function public.check_post_media();

create or replace function public.check_moodboard_media()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.owns_all_media(new.owner_id, new.media_ids) then
    raise exception 'Imagem não pertence ao dono do moodboard';
  end if;
  return new;
end;
$$;
drop trigger if exists moodboards_media_check on public.moodboards;
create trigger moodboards_media_check before insert or update of media_ids on public.moodboards
  for each row execute function public.check_moodboard_media();

-- ---------------------------------------------------------------------
-- Quem pode ver uma imagem
-- ---------------------------------------------------------------------
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
    );
$$;

-- Mídia: dono gerencia; outros só leem o que está visível
drop policy if exists "mídia: dono" on public.media;
drop policy if exists "mídia: dono gerencia" on public.media;
create policy "mídia: dono gerencia" on public.media for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "mídia: leitura por vínculo" on public.media;
create policy "mídia: leitura por vínculo" on public.media for select to authenticated
  using (public.media_visible(id));

-- Moodboards
alter table public.moodboards enable row level security;
drop policy if exists "moodboard: leitura" on public.moodboards;
create policy "moodboard: leitura" on public.moodboards for select to authenticated
  using (public.can_view(owner_id, visibility));
drop policy if exists "moodboard: dono escreve" on public.moodboards;
create policy "moodboard: dono escreve" on public.moodboards for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- page_media: só o dono da página e da mídia
alter table public.page_media enable row level security;
drop policy if exists "page_media: leitura" on public.page_media;
create policy "page_media: leitura" on public.page_media for select to authenticated
  using (exists (select 1 from public.pages pg where pg.id = page_id));
drop policy if exists "page_media: dono escreve" on public.page_media;
create policy "page_media: dono escreve" on public.page_media for all to authenticated
  using (exists (select 1 from public.pages pg where pg.id = page_id and pg.owner_id = (select auth.uid())))
  with check (
    exists (select 1 from public.pages pg where pg.id = page_id and pg.owner_id = (select auth.uid()))
    and exists (select 1 from public.media m where m.id = media_id and m.owner_id = (select auth.uid()))
  );

-- Storage: além do dono, quem pode ver a imagem editada pode baixá-la.
-- O arquivo original (sem edição) continua visível só para o dono.
drop policy if exists "media: leitura por vínculo" on storage.objects;
create policy "media: leitura por vínculo" on storage.objects for select to authenticated
  using (
    bucket_id = 'media'
    and exists (
      select 1 from public.media m
      where m.storage_path = name and public.media_visible(m.id)
    )
  );

-- Moodboard por link (não listado)
create or replace function public.shared_moodboard(token uuid)
returns setof public.moodboards
language sql
stable
security definer
set search_path = ''
as $$
  select mb.* from public.moodboards mb
  where mb.share_token = token
    and mb.visibility in ('unlisted', 'public')
    and (auth.uid() is null or not public.is_blocked(mb.owner_id, auth.uid()));
$$;

-- =====================================================================
-- Etapa 6: encontros no mapa (sempre privados, só entre amigos)
-- O local exato (nome do lugar e coordenadas) só é revelado ao criador
-- e a quem aceitou o convite. Antes disso, só a região aproximada (~1 km).
-- =====================================================================

create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 120),
  description   text not null default '' check (char_length(description) <= 1000),
  starts_at     timestamptz not null,
  area_label    text not null default '' check (char_length(area_label) <= 120),
  place_name    text not null default '' check (char_length(place_name) <= 160),
  lat           double precision check (lat between -90 and 90),
  lng           double precision check (lng between -180 and 180),
  approx_lat    double precision,
  approx_lng    double precision,
  created_at    timestamptz not null default now()
);
create index if not exists events_creator_idx on public.events (creator_id, starts_at);

-- Região aproximada: coordenadas arredondadas a 2 casas (~1,1 km)
create or replace function public.events_set_approx()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.lat is null or new.lng is null then
    new.approx_lat := null;
    new.approx_lng := null;
  else
    new.approx_lat := round(new.lat::numeric, 2)::double precision;
    new.approx_lng := round(new.lng::numeric, 2)::double precision;
  end if;
  return new;
end;
$$;
drop trigger if exists events_approx on public.events;
create trigger events_approx before insert or update of lat, lng on public.events
  for each row execute function public.events_set_approx();

create table if not exists public.event_invites (
  event_id      uuid not null references public.events (id) on delete cascade,
  invitee_id    uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  responded_at  timestamptz,
  primary key (event_id, invitee_id)
);
create index if not exists event_invites_invitee_idx on public.event_invites (invitee_id);

alter table public.events enable row level security;
alter table public.event_invites enable row level security;

-- Tabela de eventos: acesso direto só do criador. Convidados usam as funções abaixo.
drop policy if exists "evento: criador" on public.events;
create policy "evento: criador" on public.events for all to authenticated
  using (creator_id = (select auth.uid())) with check (creator_id = (select auth.uid()));

create or replace function public.is_event_creator(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.events e where e.id = eid and e.creator_id = auth.uid());
$$;

drop policy if exists "convite: criador e convidado leem" on public.event_invites;
create policy "convite: criador e convidado leem" on public.event_invites for select to authenticated
  using (invitee_id = (select auth.uid()) or public.is_event_creator(event_id));
drop policy if exists "convite: criador convida amigos" on public.event_invites;
create policy "convite: criador convida amigos" on public.event_invites for insert to authenticated
  with check (
    public.is_event_creator(event_id)
    and status = 'pending'
    and public.are_friends((select auth.uid()), invitee_id)
    and not public.is_blocked((select auth.uid()), invitee_id)
  );
drop policy if exists "convite: convidado responde" on public.event_invites;
create policy "convite: convidado responde" on public.event_invites for update to authenticated
  using (invitee_id = (select auth.uid()))
  with check (invitee_id = (select auth.uid()) and status in ('accepted', 'declined'));
drop policy if exists "convite: criador ou convidado remove" on public.event_invites;
create policy "convite: criador ou convidado remove" on public.event_invites for delete to authenticated
  using (invitee_id = (select auth.uid()) or public.is_event_creator(event_id));

-- ---------------------------------------------------------------------
-- Leitura segura para convidados
-- ---------------------------------------------------------------------
create or replace function public.my_events()
returns table (
  id uuid, title text, description text, starts_at timestamptz, area_label text,
  place_name text, lat double precision, lng double precision,
  approx_lat double precision, approx_lng double precision,
  is_creator boolean, my_status text, exact_visible boolean,
  creator_username text, creator_display_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select e.*, (e.creator_id = auth.uid()) as creator, i.status as inv_status
    from public.events e
    left join public.event_invites i on i.event_id = e.id and i.invitee_id = auth.uid()
    where auth.uid() is not null
      and (e.creator_id = auth.uid() or i.invitee_id is not null)
      and not public.is_blocked(e.creator_id, auth.uid())
  )
  select
    m.id, m.title, m.description, m.starts_at, m.area_label,
    case when v.ok then m.place_name else '' end,
    case when v.ok then m.lat end,
    case when v.ok then m.lng end,
    m.approx_lat, m.approx_lng,
    m.creator, m.inv_status, v.ok,
    p.username, p.display_name
  from mine m
  cross join lateral (
    select (m.creator or m.inv_status = 'accepted')
           and m.starts_at > now() - interval '7 days' as ok
  ) v
  join public.profiles p on p.id = m.creator_id
  order by m.starts_at asc;
$$;

create or replace function public.event_attendees(eid uuid)
returns table (invitee_id uuid, username text, display_name text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.invitee_id, p.username, p.display_name, i.status
  from public.event_invites i
  join public.profiles p on p.id = i.invitee_id
  where i.event_id = eid
    and (
      -- O criador vê todos os convites; quem aceitou vê só quem também aceitou.
      public.is_event_creator(eid)
      or (
        i.status = 'accepted'
        and exists (
          select 1 from public.event_invites me
          where me.event_id = eid and me.invitee_id = auth.uid() and me.status = 'accepted'
        )
      )
    )
  order by p.username;
$$;

revoke execute on function public.my_events() from anon;
revoke execute on function public.event_attendees(uuid) from anon;

-- Apaga o local exato de encontros que terminaram há mais de 7 dias (RF-84).
-- Agende diariamente em Supabase → Integrations → Cron:
--   select public.purge_old_event_locations();
create or replace function public.purge_old_event_locations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.events
     set lat = null, lng = null, place_name = ''
   where starts_at < now() - interval '7 days'
     and (lat is not null or place_name <> '');
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.purge_old_event_locations() from public, anon, authenticated;

-- =====================================================================
-- Etapa 5: playlists com músicas do YouTube
-- =====================================================================

create table if not exists public.playlists (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  description  text not null default '' check (char_length(description) <= 500),
  visibility   public.visibility not null default 'private',
  share_token  uuid not null default gen_random_uuid() unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists playlists_owner_idx on public.playlists (owner_id);
drop trigger if exists playlists_updated_at on public.playlists;
create trigger playlists_updated_at before update on public.playlists
  for each row execute function public.set_updated_at();

create table if not exists public.playlist_tracks (
  id           uuid primary key default gen_random_uuid(),
  playlist_id  uuid not null references public.playlists (id) on delete cascade,
  youtube_id   text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  title        text not null default '' check (char_length(title) <= 200),
  author       text not null default '' check (char_length(author) <= 120),
  position     integer not null default 0,
  added_at     timestamptz not null default now()
);
create index if not exists playlist_tracks_order_idx on public.playlist_tracks (playlist_id, position);

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
drop trigger if exists playlist_tracks_size on public.playlist_tracks;
create trigger playlist_tracks_size before insert on public.playlist_tracks
  for each row execute function public.check_playlist_size();

alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;

drop policy if exists "playlist: leitura" on public.playlists;
create policy "playlist: leitura" on public.playlists for select to authenticated
  using (public.can_view(owner_id, visibility));
drop policy if exists "playlist: dono escreve" on public.playlists;
create policy "playlist: dono escreve" on public.playlists for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "faixa: leitura" on public.playlist_tracks;
create policy "faixa: leitura" on public.playlist_tracks for select to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id));
drop policy if exists "faixa: dono escreve" on public.playlist_tracks;
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
