-- =====================================================================
-- Rede diário mental-health friendly — migração inicial (Etapa 1 do MVP)
-- Postgres / Supabase. Toda tabela tem RLS ativo; nada é lido sem política.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.visibility as enum ('private', 'friends', 'unlisted', 'public');
create type public.friendship_status as enum ('pending', 'accepted');
create type public.reply_policy as enum ('friends', 'everyone', 'nobody');

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
create table public.profiles (
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
create unique index profiles_username_key on public.profiles (lower(username));
create trigger profiles_updated_at before update on public.profiles
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Amizades e bloqueios
-- ---------------------------------------------------------------------
create table public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles (id) on delete cascade,
  addressee_id  uuid not null references public.profiles (id) on delete cascade,
  status        public.friendship_status not null default 'pending',
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  constraint no_self_friendship check (requester_id <> addressee_id)
);
create unique index friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table public.user_blocks (
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
create table public.wikis (
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
create index wikis_owner_idx on public.wikis (owner_id);
create trigger wikis_updated_at before update on public.wikis
  for each row execute function public.set_updated_at();

create table public.pages (
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
create index pages_wiki_idx on public.pages (wiki_id, position);
create trigger pages_updated_at before update on public.pages
  for each row execute function public.set_updated_at();

create table public.page_versions (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references public.pages (id) on delete cascade,
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title       text not null,
  blocks      jsonb not null,
  created_at  timestamptz not null default now()
);
create index page_versions_page_idx on public.page_versions (page_id, created_at desc);

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
create table public.media (
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
create table public.missions (
  id            uuid primary key default gen_random_uuid(),
  mission_date  date not null unique,
  prompt        text not null,
  category      text not null check (category in ('memoria', 'gratidao', 'mundo', 'interesses', 'criatividade'))
);

-- ---------------------------------------------------------------------
-- Posts e respostas privadas
-- ---------------------------------------------------------------------
create table public.posts (
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
create index posts_feed_idx on public.posts (created_at desc);
create index posts_author_idx on public.posts (author_id, created_at desc);
create trigger posts_updated_at before update on public.posts
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

create table public.post_replies (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  sender_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index post_replies_post_idx on public.post_replies (post_id, created_at);

-- ---------------------------------------------------------------------
-- Mensagens privadas 1:1 (apenas entre amigos)
-- ---------------------------------------------------------------------
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  sender_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  recipient_id    uuid not null references public.profiles (id) on delete cascade,
  body            text not null default '' check (char_length(body) <= 4000),
  shared_post_id  uuid references public.posts (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint message_has_content check (char_length(body) > 0 or shared_post_id is not null),
  constraint no_self_message check (sender_id <> recipient_id)
);
create index messages_pair_idx on public.messages
  (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc);

-- ---------------------------------------------------------------------
-- Dispositivos confiáveis (confirmação de login em dispositivo novo)
-- Escrita apenas pelo servidor (service role); usuário lê e revoga.
-- ---------------------------------------------------------------------
create table public.trusted_devices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  token_hash    text not null unique,
  label         text not null default '',
  confirmed_at  timestamptz,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index trusted_devices_user_idx on public.trusted_devices (user_id);

-- ---------------------------------------------------------------------
-- Denúncias
-- ---------------------------------------------------------------------
create table public.reports (
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
create policy "perfil: leitura" on public.profiles for select to authenticated
  using (public.can_view(id, profile_visibility));
create policy "perfil: edição do dono" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Amizades
create policy "amizade: envolvidos leem" on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
create policy "amizade: enviar pedido" on public.friendships for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'pending'
    and not public.is_blocked(requester_id, addressee_id)
    and public.accepts_requests(addressee_id)
  );
create policy "amizade: destinatário aceita" on public.friendships for update to authenticated
  using (addressee_id = (select auth.uid()))
  with check (addressee_id = (select auth.uid()) and status = 'accepted');
create policy "amizade: envolvidos removem" on public.friendships for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- Bloqueios: só quem bloqueou vê e gerencia (o bloqueado não é notificado)
create policy "bloqueio: dono" on public.user_blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

-- Wikis
create policy "wiki: leitura" on public.wikis for select to authenticated
  using (public.can_view(owner_id, visibility));
create policy "wiki: dono escreve" on public.wikis for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Páginas: precisam passar na visibilidade da página E da wiki
create policy "página: leitura" on public.pages for select to authenticated
  using (
    public.can_view(owner_id, visibility)
    and exists (
      select 1 from public.wikis w
      where w.id = wiki_id and public.can_view(w.owner_id, w.visibility)
    )
  );
create policy "página: dono escreve" on public.pages for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.wikis w where w.id = wiki_id and w.owner_id = (select auth.uid()))
  );

create policy "versões: dono" on public.page_versions for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Mídia: por enquanto apenas o dono (compartilhamento via conteúdo vinculado na Etapa 3)
create policy "mídia: dono" on public.media for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Missões: leitura das missões já liberadas
create policy "missões: leitura" on public.missions for select to authenticated
  using (mission_date <= current_date);

-- Posts
create policy "post: leitura" on public.posts for select to authenticated
  using (public.can_view(author_id, visibility));
create policy "post: autor escreve" on public.posts for all to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));

-- Respostas: só remetente e autor do post leem
create policy "resposta: remetente e autor leem" on public.post_replies for select to authenticated
  using (
    sender_id = (select auth.uid())
    or exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
  );
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
create policy "resposta: remetente apaga" on public.post_replies for delete to authenticated
  using (sender_id = (select auth.uid()));

-- Mensagens: participantes leem; só amigos enviam
create policy "mensagem: participantes leem" on public.messages for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));
create policy "mensagem: amigos enviam" on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.are_friends(sender_id, recipient_id)
    and not public.is_blocked(sender_id, recipient_id)
  );
create policy "mensagem: remetente apaga" on public.messages for delete to authenticated
  using (sender_id = (select auth.uid()));

-- Dispositivos: usuário lê e revoga; criação/confirmação só pelo servidor
create policy "dispositivo: dono lê" on public.trusted_devices for select to authenticated
  using (user_id = (select auth.uid()));
create policy "dispositivo: dono revoga" on public.trusted_devices for delete to authenticated
  using (user_id = (select auth.uid()));

-- Denúncias
create policy "denúncia: criar" on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy "denúncia: ler as próprias" on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()));

-- =====================================================================
-- Storage: bucket privado "media", pasta por usuário (<uid>/arquivo)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

create policy "media: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media: dono lê" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media: dono atualiza" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
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
