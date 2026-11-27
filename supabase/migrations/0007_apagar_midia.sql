-- =====================================================================
-- Etapa 8: apagar imagens da galeria sem deixar referências quebradas
-- Pode ser executado mais de uma vez.
-- =====================================================================

-- As checagens "a imagem é sua?" passam a olhar só as imagens ADICIONADAS.
-- Assim, tirar uma imagem apagada de um post/moodboard/espaço não esbarra
-- nas outras referências que também estão sendo apagadas na mesma operação.
create or replace function public.added_media(new_ids uuid[], old_ids uuid[])
returns uuid[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(x), '{}')
  from unnest(coalesce(new_ids, '{}')) as x
  where not (x = any (coalesce(old_ids, '{}')));
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
  if not public.owns_all_media(
    new.author_id,
    case when tg_op = 'UPDATE' then public.added_media(new.media_ids, old.media_ids) else new.media_ids end
  ) then
    raise exception 'Imagem não pertence ao autor';
  end if;
  return new;
end;
$$;

create or replace function public.check_moodboard_media()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.owns_all_media(
    new.owner_id,
    case when tg_op = 'UPDATE' then public.added_media(new.media_ids, old.media_ids) else new.media_ids end
  ) then
    raise exception 'Imagem não pertence ao dono do moodboard';
  end if;
  return new;
end;
$$;

create or replace function public.check_space_media()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ids uuid[] := array_remove(array[new.avatar_media_id, new.bg_media_id], null) || new.about_media_ids;
begin
  if tg_op = 'UPDATE' then
    ids := public.added_media(
      ids,
      array_remove(array[old.avatar_media_id, old.bg_media_id], null) || old.about_media_ids
    );
  end if;
  if not public.owns_all_media(new.owner_id, ids) then
    raise exception 'Imagem não pertence ao dono do espaço';
  end if;
  return new;
end;
$$;

-- Ao apagar imagens, elas saem dos posts, moodboards e do "Sobre mim" de uma
-- vez só (gatilho por comando, depois que foto/fundo do espaço já viraram vazio
-- pela chave estrangeira). Páginas de wiki perdem o vínculo pela page_media.
create or replace function public.forget_deleted_media()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  gone_ids uuid[];
begin
  select coalesce(array_agg(g.id), '{}') into gone_ids from gone g;
  if cardinality(gone_ids) = 0 then
    return null;
  end if;

  update public.posts p
     set media_ids = array(select x from unnest(p.media_ids) with ordinality as t(x, n) where not (x = any (gone_ids)) order by n)
   where p.media_ids && gone_ids;
  update public.moodboards mb
     set media_ids = array(select x from unnest(mb.media_ids) with ordinality as t(x, n) where not (x = any (gone_ids)) order by n)
   where mb.media_ids && gone_ids;
  update public.spaces s
     set about_media_ids = array(select x from unnest(s.about_media_ids) with ordinality as t(x, n) where not (x = any (gone_ids)) order by n)
   where s.about_media_ids && gone_ids;
  return null;
end;
$$;
drop trigger if exists media_forget on public.media;
create trigger media_forget
  after delete on public.media
  referencing old table as gone
  for each statement execute function public.forget_deleted_media();
