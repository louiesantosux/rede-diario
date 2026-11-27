-- =====================================================================
-- Etapa 6: Meu espaço (perfil personalizável, módulos e mural de recados)
-- Pode ser executado mais de uma vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Espaço: aparência, módulos e "Sobre mim". Acesso direto só do dono;
-- visitantes leem pela função get_space, que filtra por módulo.
-- ---------------------------------------------------------------------
create table if not exists public.spaces (
  owner_id        uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  theme           jsonb not null default '{}'::jsonb,
  modules         jsonb not null default '[
    {"key": "sobre", "on": true, "vis": "friends"},
    {"key": "posts", "on": true, "vis": "friends"},
    {"key": "missoes", "on": true, "vis": "friends"},
    {"key": "wikis", "on": true, "vis": "friends"},
    {"key": "moodboards", "on": true, "vis": "friends"},
    {"key": "playlists", "on": true, "vis": "friends"},
    {"key": "galeria", "on": false, "vis": "friends"},
    {"key": "amigos", "on": true, "vis": "friends"},
    {"key": "mural", "on": true, "vis": "friends"}
  ]'::jsonb,
  about           jsonb,
  about_media_ids uuid[] not null default '{}',
  avatar_media_id uuid references public.media (id) on delete set null,
  bg_media_id     uuid references public.media (id) on delete set null,
  updated_at      timestamptz not null default now(),
  constraint spaces_modules_array check (jsonb_typeof(modules) = 'array' and jsonb_array_length(modules) <= 20),
  constraint spaces_about_size check (about is null or octet_length(about::text) <= 200000),
  constraint spaces_about_media check (cardinality(about_media_ids) <= 20)
);

drop trigger if exists spaces_updated_at on public.spaces;
create trigger spaces_updated_at
  before update on public.spaces
  for each row execute function public.set_updated_at();

-- Só imagens do próprio dono podem ser usadas no espaço
create or replace function public.check_space_media()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.owns_all_media(
    new.owner_id,
    array_remove(array[new.avatar_media_id, new.bg_media_id], null) || new.about_media_ids
  ) then
    raise exception 'Imagem não pertence ao dono do espaço';
  end if;
  return new;
end;
$$;
drop trigger if exists spaces_media_check on public.spaces;
create trigger spaces_media_check
  before insert or update on public.spaces
  for each row execute function public.check_space_media();

alter table public.spaces enable row level security;
drop policy if exists "espaço: dono" on public.spaces;
create policy "espaço: dono" on public.spaces for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Todo perfil ganha um espaço com os módulos padrão
create or replace function public.handle_new_profile_space()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.spaces (owner_id) values (new.id) on conflict (owner_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_profile_created_space on public.profiles;
create trigger on_profile_created_space
  after insert on public.profiles
  for each row execute function public.handle_new_profile_space();

insert into public.spaces (owner_id)
select p.id from public.profiles p
on conflict (owner_id) do nothing;

-- ---------------------------------------------------------------------
-- Um módulo está visível para quem está vendo?
-- Precisa estar ligado. O dono vê todos os ligados; os outros dependem da
-- visibilidade do perfil e da visibilidade do módulo.
-- ---------------------------------------------------------------------
create or replace function public.space_module_visible(p_owner uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.spaces s
    join public.profiles p on p.id = s.owner_id
    cross join lateral jsonb_array_elements(s.modules) as m(item)
    where s.owner_id = p_owner
      and m.item ->> 'key' = p_key
      and coalesce((m.item ->> 'on')::boolean, false)
      and public.can_view(p_owner, p.profile_visibility)
      and public.can_view(
        p_owner,
        (case when m.item ->> 'vis' in ('private', 'friends', 'public') then m.item ->> 'vis' else 'private' end)::public.visibility
      )
  );
$$;

-- Espaço de alguém pelo @usuário, já filtrado para quem está vendo
create or replace function public.get_space(handle text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'display_name', p.display_name,
    'mood', p.mood,
    'bio', p.bio,
    'is_owner', p.id = auth.uid(),
    'is_friend', public.are_friends(p.id, auth.uid()),
    'theme', coalesce(s.theme, '{}'::jsonb),
    'modules', coalesce((
      select jsonb_agg(m.item order by m.ord)
      from jsonb_array_elements(s.modules) with ordinality as m(item, ord)
      where public.space_module_visible(p.id, m.item ->> 'key')
    ), '[]'::jsonb),
    'about', case when public.space_module_visible(p.id, 'sobre') then s.about end,
    'avatar_media_id', s.avatar_media_id,
    'bg_media_id', s.bg_media_id
  )
  from public.profiles p
  left join public.spaces s on s.owner_id = p.id
  where auth.uid() is not null
    and lower(p.username) = lower(handle)
    and public.can_view(p.id, p.profile_visibility);
$$;

-- Amigos do dono do espaço, em ordem alfabética (sem ranking nem contagem)
create or replace function public.friends_of_space(p_owner uuid)
returns table (username text, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.username, o.display_name
  from public.friendships f
  join public.profiles o
    on o.id = case when f.requester_id = p_owner then f.addressee_id else f.requester_id end
  where f.status = 'accepted'
    and p_owner in (f.requester_id, f.addressee_id)
    and public.space_module_visible(p_owner, 'amigos')
    and (auth.uid() = o.id or not public.is_blocked(o.id, auth.uid()))
  order by lower(coalesce(nullif(o.display_name, ''), o.username))
  limit 500;
$$;

-- ---------------------------------------------------------------------
-- Mural de recados: amigos escrevem; nada aparece sem aprovação do dono.
-- ---------------------------------------------------------------------
create table if not exists public.space_notes (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  author_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 500),
  approved   boolean not null default false,
  created_at timestamptz not null default now(),
  constraint space_notes_not_self check (owner_id <> author_id)
);
create index if not exists space_notes_owner_idx on public.space_notes (owner_id, approved, created_at desc);

-- Até 3 recados aguardando aprovação por amigo, para evitar insistência
create or replace function public.limit_pending_notes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.space_notes n
    where n.owner_id = new.owner_id and n.author_id = new.author_id and not n.approved
  ) >= 3 then
    raise exception 'Limite de recados aguardando aprovação';
  end if;
  return new;
end;
$$;
drop trigger if exists space_notes_limit on public.space_notes;
create trigger space_notes_limit
  before insert on public.space_notes
  for each row execute function public.limit_pending_notes();

alter table public.space_notes enable row level security;
drop policy if exists "recado: leitura" on public.space_notes;
create policy "recado: leitura" on public.space_notes for select to authenticated
  using (
    (select auth.uid()) in (owner_id, author_id)
    or (approved and public.space_module_visible(owner_id, 'mural') and not public.is_blocked(author_id, (select auth.uid())))
  );
drop policy if exists "recado: amigo escreve" on public.space_notes;
create policy "recado: amigo escreve" on public.space_notes for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and owner_id <> (select auth.uid())
    and not approved
    and public.are_friends(owner_id, (select auth.uid()))
    and not public.is_blocked(owner_id, (select auth.uid()))
    and public.space_module_visible(owner_id, 'mural')
  );
drop policy if exists "recado: dono aprova" on public.space_notes;
create policy "recado: dono aprova" on public.space_notes for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "recado: dono ou autor apaga" on public.space_notes;
create policy "recado: dono ou autor apaga" on public.space_notes for delete to authenticated
  using ((select auth.uid()) in (owner_id, author_id));

-- O dono só pode mudar a aprovação; o texto nunca é editado por terceiros
revoke update on public.space_notes from authenticated;
grant update (approved) on public.space_notes to authenticated;

-- Recados com nome do autor (o visitante pode não ter acesso ao perfil do autor)
create or replace function public.space_notes_of(p_owner uuid)
returns table (
  id uuid, body text, approved boolean, created_at timestamptz,
  author_username text, author_display_name text, is_mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.body, n.approved, n.created_at, a.username, a.display_name, n.author_id = auth.uid()
  from public.space_notes n
  join public.profiles a on a.id = n.author_id
  where n.owner_id = p_owner
    and auth.uid() is not null
    and not public.is_blocked(n.author_id, p_owner)
    and (
      p_owner = auth.uid()
      or n.author_id = auth.uid()
      or (n.approved and public.space_module_visible(p_owner, 'mural') and not public.is_blocked(n.author_id, auth.uid()))
    )
  order by n.created_at desc
  limit 100;
$$;

revoke execute on function public.get_space(text) from anon;
revoke execute on function public.friends_of_space(uuid) from anon;
revoke execute on function public.space_notes_of(uuid) from anon;
revoke execute on function public.space_module_visible(uuid, text) from anon;

-- ---------------------------------------------------------------------
-- Imagens do espaço: foto e fundo seguem o perfil; as do "Sobre mim"
-- seguem a visibilidade do módulo.
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
    );
$$;
