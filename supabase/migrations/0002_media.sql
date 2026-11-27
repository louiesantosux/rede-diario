-- =====================================================================
-- Etapa 3: imagens, moodboards e imagens em posts e páginas
-- Regra central: uma imagem só é visível para quem pode ver algum
-- conteúdo que a usa (post, moodboard ou página de wiki), além do dono.
-- =====================================================================

alter table public.media add column if not exists original_path text;

-- Imagens anexadas a posts
alter table public.posts add column if not exists media_ids uuid[] not null default '{}';

-- Moodboards
create table public.moodboards (
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
create index moodboards_owner_idx on public.moodboards (owner_id);
create trigger moodboards_updated_at before update on public.moodboards
  for each row execute function public.set_updated_at();

-- Imagens usadas em páginas de wiki (mantida pelo app ao salvar a página)
create table public.page_media (
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
create policy "mídia: dono gerencia" on public.media for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "mídia: leitura por vínculo" on public.media for select to authenticated
  using (public.media_visible(id));

-- Moodboards
alter table public.moodboards enable row level security;
create policy "moodboard: leitura" on public.moodboards for select to authenticated
  using (public.can_view(owner_id, visibility));
create policy "moodboard: dono escreve" on public.moodboards for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- page_media: só o dono da página e da mídia
alter table public.page_media enable row level security;
create policy "page_media: leitura" on public.page_media for select to authenticated
  using (exists (select 1 from public.pages pg where pg.id = page_id));
create policy "page_media: dono escreve" on public.page_media for all to authenticated
  using (exists (select 1 from public.pages pg where pg.id = page_id and pg.owner_id = (select auth.uid())))
  with check (
    exists (select 1 from public.pages pg where pg.id = page_id and pg.owner_id = (select auth.uid()))
    and exists (select 1 from public.media m where m.id = media_id and m.owner_id = (select auth.uid()))
  );

-- Storage: além do dono, quem pode ver a imagem editada pode baixá-la.
-- O arquivo original (sem edição) continua visível só para o dono.
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
