-- =====================================================================
-- Etapa 6: encontros no mapa (sempre privados, só entre amigos)
-- O local exato (nome do lugar e coordenadas) só é revelado ao criador
-- e a quem aceitou o convite. Antes disso, só a região aproximada (~1 km).
-- =====================================================================

create table public.events (
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
create index events_creator_idx on public.events (creator_id, starts_at);

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
create trigger events_approx before insert or update of lat, lng on public.events
  for each row execute function public.events_set_approx();

create table public.event_invites (
  event_id      uuid not null references public.events (id) on delete cascade,
  invitee_id    uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  responded_at  timestamptz,
  primary key (event_id, invitee_id)
);
create index event_invites_invitee_idx on public.event_invites (invitee_id);

alter table public.events enable row level security;
alter table public.event_invites enable row level security;

-- Tabela de eventos: acesso direto só do criador. Convidados usam as funções abaixo.
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

create policy "convite: criador e convidado leem" on public.event_invites for select to authenticated
  using (invitee_id = (select auth.uid()) or public.is_event_creator(event_id));
create policy "convite: criador convida amigos" on public.event_invites for insert to authenticated
  with check (
    public.is_event_creator(event_id)
    and status = 'pending'
    and public.are_friends((select auth.uid()), invitee_id)
    and not public.is_blocked((select auth.uid()), invitee_id)
  );
create policy "convite: convidado responde" on public.event_invites for update to authenticated
  using (invitee_id = (select auth.uid()))
  with check (invitee_id = (select auth.uid()) and status in ('accepted', 'declined'));
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
