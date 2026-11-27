-- =====================================================================
-- REDE DIÁRIO — BANCO COMPLETO (substitui 0001 a 0004)
-- Pode ser executado quantas vezes for preciso: cria só o que falta e
-- recria funções, gatilhos e políticas sem apagar nenhum dado.
-- Como usar: SQL Editor → apague tudo → cole este arquivo inteiro → Run.
-- =====================================================================
-- =====================================================================
-- Rede diário mental-health friendly — migração inicial (Etapa 1 do MVP)
-- Postgres / Supabase. Toda tabela tem RLS ativo; nada é lido sem política.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type public.visibility as enum ('private', 'friends', 'unlisted', 'public');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.friendship_status as enum ('pending', 'accepted');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.reply_policy as enum ('friends', 'everyone', 'nobody');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- Utilitário: updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  username           text not null,
  display_name       text not null default '',
  bio                text not null default '',
  mood               text not null default '' check (char_length(mood) <= 80),
  avatar_path        text,
  profile_visibility public.visibility not null default 'friends'
                     check (profile_visibility in ('friends', 'public')),
  theme              jsonb not null default '{}'::jsonb,
  a11y_prefs         jsonb not null default '{}'::jsonb,
  wellbeing_prefs    jsonb not null default '{"missions": true, "missionNotifications": false}'::jsonb,
  accepts_friend_requests boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_.]{3,24}$')
);
create unique index if not exists profiles_username_key on public.profiles (lower(username));
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o perfil automaticamente no cadastro
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
begin
  if wanted !~ '^[a-z0-9_.]{3,24}$'
     or exists (select 1 from public.profiles p where lower(p.username) = wanted) then
    wanted := 'user_' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    wanted,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Amizades e bloqueios
-- ---------------------------------------------------------------------
create table if not exists public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles (id) on delete cascade,
  addressee_id  uuid not null references public.profiles (id) on delete cascade,
  status        public.friendship_status not null default 'pending',
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  constraint no_self_friendship check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table if not exists public.user_blocks (
  blocker_id  uuid not null references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- Funções de apoio às políticas (security definer para evitar recursão de RLS)
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id) = least(a, b)
      and greatest(f.requester_id, f.addressee_id) = greatest(a, b)
  );
$$;

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks ub
    where (ub.blocker_id = a and ub.blocked_id = b)
       or (ub.blocker_id = b and ub.blocked_id = a)
  );
$$;

-- Regra central de leitura: dono sempre vê; bloqueados nunca veem.
-- "unlisted" NÃO passa aqui: só é acessível pelo share_token (funções shared_*),
-- para que ninguém consiga listar conteúdo não listado consultando a tabela.
create or replace function public.can_view(owner uuid, vis public.visibility)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    owner = auth.uid()
    or (
      auth.uid() is not null
      and not public.is_blocked(owner, auth.uid())
      and (
        vis = 'public'
        or (vis = 'friends' and public.are_friends(owner, auth.uid()))
      )
    );
$$;

create or replace function public.accepts_requests(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.accepts_friend_requests from public.profiles p where p.id = target), false);
$$;

-- Cartão mínimo de perfil (nome, @, avatar) para busca exata por @usuário
-- e para pedidos de amizade. Não expõe bio, humor nem conteúdo.
create or replace function public.find_profile(handle text)
returns table (id uuid, username text, display_name text, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_path
  from public.profiles p
  where auth.uid() is not null
    and lower(p.username) = lower(handle)
    and not public.is_blocked(p.id, auth.uid())
    and (p.accepts_friend_requests or p.id = auth.uid() or public.are_friends(p.id, auth.uid()));
$$;

create or replace function public.my_friendships()
returns table (
  friendship_id uuid, status public.friendship_status, incoming boolean,
  other_id uuid, username text, display_name text, avatar_path text, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, f.status, f.addressee_id = auth.uid(),
         p.id, p.username, p.display_name, p.avatar_path, f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where auth.uid() in (f.requester_id, f.addressee_id)
  order by f.created_at desc;
$$;

revoke execute on function public.find_profile(text) from anon;
revoke execute on function public.my_friendships() from anon;

-- ---------------------------------------------------------------------
-- Wikis, páginas e versões
-- ---------------------------------------------------------------------
create table if not exists public.wikis (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  description  text not null default '',
  visibility   public.visibility not null default 'private',
  theme        jsonb not null default '{}'::jsonb,
  share_token  uuid not null default gen_random_uuid() unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists wikis_owner_idx on public.wikis (owner_id);
drop trigger if exists wikis_updated_at on public.wikis;
create trigger wikis_updated_at
  before update on public.wikis
  for each row execute function public.set_updated_at();

create table if not exists public.pages (
  id          uuid primary key default gen_random_uuid(),
  wiki_id     uuid not null references public.wikis (id) on delete cascade,
  parent_id   uuid references public.pages (id) on delete cascade,
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  blocks      jsonb not null default '[]'::jsonb,
  theme       jsonb not null default '{}'::jsonb,
  visibility  public.visibility not null default 'private',
  share_token uuid not null default gen_random_uuid() unique,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists pages_wiki_idx on public.pages (wiki_id, position);
drop trigger if exists pages_updated_at on public.pages;
create trigger pages_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

create table if not exists public.page_versions (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references public.pages (id) on delete cascade,
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title       text not null,
  blocks      jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists page_versions_page_idx on public.page_versions (page_id, created_at desc);

-- Acesso por link (não listado): exige o token, nunca o id
create or replace function public.shared_wiki(token uuid)
returns setof public.wikis
language sql
stable
security definer
set search_path = ''
as $$
  select w.* from public.wikis w
  where w.share_token = token
    and w.visibility in ('unlisted', 'public')
    and (auth.uid() is null or not public.is_blocked(w.owner_id, auth.uid()));
$$;

create or replace function public.shared_wiki_pages(token uuid)
returns setof public.pages
language sql
stable
security definer
set search_path = ''
as $$
  select pg.* from public.pages pg
  join public.wikis w on w.id = pg.wiki_id
  where w.share_token = token
    and w.visibility in ('unlisted', 'public')
    and pg.visibility in ('unlisted', 'public')
    and (auth.uid() is null or not public.is_blocked(w.owner_id, auth.uid()))
  order by pg.position;
$$;


-- ---------------------------------------------------------------------
-- Mídia (imagens) — arquivos ficam no bucket privado "media"
-- ---------------------------------------------------------------------
create table if not exists public.media (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  storage_path  text not null unique,
  edit_params   jsonb not null default '{}'::jsonb,
  alt_text      text not null default '',
  width         integer,
  height        integer,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Missões diárias (curadas pela equipe; usuários só leem)
-- ---------------------------------------------------------------------
create table if not exists public.missions (
  id            uuid primary key default gen_random_uuid(),
  mission_date  date not null unique,
  prompt        text not null,
  category      text not null check (category in ('memoria', 'gratidao', 'mundo', 'interesses', 'criatividade'))
);

-- ---------------------------------------------------------------------
-- Posts e respostas privadas
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  wiki_id       uuid references public.wikis (id) on delete set null,
  mission_id    uuid references public.missions (id) on delete set null,
  body          jsonb not null,
  visibility    public.visibility not null default 'friends',
  reply_policy  public.reply_policy not null default 'friends',
  share_token   uuid not null default gen_random_uuid() unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists posts_feed_idx on public.posts (created_at desc);
create index if not exists posts_author_idx on public.posts (author_id, created_at desc);
drop trigger if exists posts_updated_at on public.posts;
create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

create or replace function public.shared_post(token uuid)
returns setof public.posts
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.posts p
  where p.share_token = token
    and p.visibility in ('unlisted', 'public')
    and (auth.uid() is null or not public.is_blocked(p.author_id, auth.uid()));
$$;

create table if not exists public.post_replies (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  sender_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index if not exists post_replies_post_idx on public.post_replies (post_id, created_at);

-- ---------------------------------------------------------------------
-- Mensagens privadas 1:1 (apenas entre amigos)
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  sender_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  recipient_id    uuid not null references public.profiles (id) on delete cascade,
  body            text not null default '' check (char_length(body) <= 4000),
  shared_post_id  uuid references public.posts (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint message_has_content check (char_length(body) > 0 or shared_post_id is not null),
  constraint no_self_message check (sender_id <> recipient_id)
);
create index if not exists messages_pair_idx on public.messages
  (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc);

-- ---------------------------------------------------------------------
-- Dispositivos confiáveis (confirmação de login em dispositivo novo)
-- Escrita apenas pelo servidor (service role); usuário lê e revoga.
-- ---------------------------------------------------------------------
create table if not exists public.trusted_devices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  token_hash    text not null unique,
  label         text not null default '',
  confirmed_at  timestamptz,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists trusted_devices_user_idx on public.trusted_devices (user_id);

-- ---------------------------------------------------------------------
-- Denúncias
-- ---------------------------------------------------------------------
create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type  text not null check (target_type in ('profile', 'wiki', 'page', 'post', 'media', 'message')),
  target_id    uuid not null,
  reason       text not null check (char_length(reason) between 1 and 1000),
  status       text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  created_at   timestamptz not null default now()
);

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.profiles        enable row level security;
alter table public.friendships     enable row level security;
alter table public.user_blocks     enable row level security;
alter table public.wikis           enable row level security;
alter table public.pages           enable row level security;
alter table public.page_versions   enable row level security;
alter table public.media           enable row level security;
alter table public.missions        enable row level security;
alter table public.posts           enable row level security;
alter table public.post_replies    enable row level security;
alter table public.messages        enable row level security;
alter table public.trusted_devices enable row level security;
alter table public.reports         enable row level security;

-- Perfis: o próprio usuário; amigos; ou qualquer logado se o perfil for público
drop policy if exists "perfil: leitura" on public.profiles;
create policy "perfil: leitura" on public.profiles for select to authenticated
  using (public.can_view(id, profile_visibility));
drop policy if exists "perfil: edição do dono" on public.profiles;
create policy "perfil: edição do dono" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Amizades
drop policy if exists "amizade: envolvidos leem" on public.friendships;
create policy "amizade: envolvidos leem" on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
drop policy if exists "amizade: enviar pedido" on public.friendships;
create policy "amizade: enviar pedido" on public.friendships for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'pending'
    and not public.is_blocked(requester_id, addressee_id)
    and public.accepts_requests(addressee_id)
  );
drop policy if exists "amizade: destinatário aceita" on public.friendships;
create policy "amizade: destinatário aceita" on public.friendships for update to authenticated
  using (addressee_id = (select auth.uid()))
  with check (addressee_id = (select auth.uid()) and status = 'accepted');
drop policy if exists "amizade: envolvidos removem" on public.friendships;
create policy "amizade: envolvidos removem" on public.friendships for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- Bloqueios: só quem bloqueou vê e gerencia (o bloqueado não é notificado)
drop policy if exists "bloqueio: dono" on public.user_blocks;
create policy "bloqueio: dono" on public.user_blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

-- Wikis
drop policy if exists "wiki: leitura" on public.wikis;
create policy "wiki: leitura" on public.wikis for select to authenticated
  using (public.can_view(owner_id, visibility));
drop policy if exists "wiki: dono escreve" on public.wikis;
create policy "wiki: dono escreve" on public.wikis for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Páginas: precisam passar na visibilidade da página E da wiki
drop policy if exists "página: leitura" on public.pages;
create policy "página: leitura" on public.pages for select to authenticated
  using (
    public.can_view(owner_id, visibility)
    and exists (
      select 1 from public.wikis w
      where w.id = wiki_id and public.can_view(w.owner_id, w.visibility)
    )
  );
drop policy if exists "página: dono escreve" on public.pages;
create policy "página: dono escreve" on public.pages for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.wikis w where w.id = wiki_id and w.owner_id = (select auth.uid()))
  );

drop policy if exists "versões: dono" on public.page_versions;
create policy "versões: dono" on public.page_versions for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Mídia: por enquanto apenas o dono (compartilhamento via conteúdo vinculado na Etapa 3)
drop policy if exists "mídia: dono" on public.media;
create policy "mídia: dono" on public.media for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Missões: leitura das missões já liberadas
drop policy if exists "missões: leitura" on public.missions;
create policy "missões: leitura" on public.missions for select to authenticated
  using (mission_date <= current_date);

-- Posts
drop policy if exists "post: leitura" on public.posts;
create policy "post: leitura" on public.posts for select to authenticated
  using (public.can_view(author_id, visibility));
drop policy if exists "post: autor escreve" on public.posts;
create policy "post: autor escreve" on public.posts for all to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));

-- Respostas: só remetente e autor do post leem
drop policy if exists "resposta: remetente e autor leem" on public.post_replies;
create policy "resposta: remetente e autor leem" on public.post_replies for select to authenticated
  using (
    sender_id = (select auth.uid())
    or exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
  );
drop policy if exists "resposta: enviar conforme política do post" on public.post_replies;
create policy "resposta: enviar conforme política do post" on public.post_replies for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.author_id <> (select auth.uid())
        and public.can_view(p.author_id, p.visibility)
        and (
          p.reply_policy = 'everyone'
          or (p.reply_policy = 'friends' and public.are_friends(p.author_id, (select auth.uid())))
        )
    )
  );
drop policy if exists "resposta: remetente apaga" on public.post_replies;
create policy "resposta: remetente apaga" on public.post_replies for delete to authenticated
  using (sender_id = (select auth.uid()));

-- Mensagens: participantes leem; só amigos enviam
drop policy if exists "mensagem: participantes leem" on public.messages;
create policy "mensagem: participantes leem" on public.messages for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));
drop policy if exists "mensagem: amigos enviam" on public.messages;
create policy "mensagem: amigos enviam" on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.are_friends(sender_id, recipient_id)
    and not public.is_blocked(sender_id, recipient_id)
  );
drop policy if exists "mensagem: remetente apaga" on public.messages;
create policy "mensagem: remetente apaga" on public.messages for delete to authenticated
  using (sender_id = (select auth.uid()));

-- Dispositivos: usuário lê e revoga; criação/confirmação só pelo servidor
drop policy if exists "dispositivo: dono lê" on public.trusted_devices;
create policy "dispositivo: dono lê" on public.trusted_devices for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "dispositivo: dono revoga" on public.trusted_devices;
create policy "dispositivo: dono revoga" on public.trusted_devices for delete to authenticated
  using (user_id = (select auth.uid()));

-- Denúncias
drop policy if exists "denúncia: criar" on public.reports;
create policy "denúncia: criar" on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
drop policy if exists "denúncia: ler as próprias" on public.reports;
create policy "denúncia: ler as próprias" on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()));

-- =====================================================================
-- Storage: bucket privado "media", pasta por usuário (<uid>/arquivo)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

drop policy if exists "media: dono envia" on storage.objects;
create policy "media: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "media: dono lê" on storage.objects;
create policy "media: dono lê" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "media: dono atualiza" on storage.objects;
create policy "media: dono atualiza" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "media: dono apaga" on storage.objects;
create policy "media: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- =====================================================================
-- Missões de exemplo (a equipe editorial substitui por um calendário real)
-- =====================================================================
insert into public.missions (mission_date, prompt, category) values
  (current_date,     'Conte uma história sobre a sua infância.',                'memoria'),
  (current_date + 1, 'Uma coisa boa que aconteceu no mundo hoje.',              'mundo'),
  (current_date + 2, 'Qual objeto da sua coleção tem a melhor história?',       'interesses'),
  (current_date + 3, 'Descreva um lugar onde você se sente em paz.',            'gratidao'),
  (current_date + 4, 'Monte um moodboard com as cores da sua semana.',          'criatividade')
on conflict (mission_date) do nothing;

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
create trigger moodboards_updated_at
  before update on public.moodboards
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
create trigger posts_media_check
  before insert or update of media_ids on public.posts
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
create trigger moodboards_media_check
  before insert or update of media_ids on public.moodboards
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
create trigger events_approx
  before insert or update of lat, lng on public.events
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
create trigger playlists_updated_at
  before update on public.playlists
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
create trigger playlist_tracks_size
  before insert on public.playlist_tracks
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
