-- Migratie 1 — Familieboom: tabellen, enums, RLS-policies.
-- Ontwerp: zie 04-backend-schema.md (§1–§9).
-- Idempotent geschreven (enums via DO-guards, create table if not exists,
-- create or replace function, drop policy if exists) zodat herhaald draaien
-- in de SQL-editor veilig is. De RPC-leesfuncties komen in migratie 2.

-- ─────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────
do $$ begin create type visibility as enum ('public','family','private'); exception when duplicate_object then null; end $$;
do $$ begin create type union_type as enum ('marriage','registered','cohabitation','relationship'); exception when duplicate_object then null; end $$;
do $$ begin create type union_end_reason as enum ('divorce','separation','death'); exception when duplicate_object then null; end $$;
do $$ begin create type parent_role as enum ('biological','adoptive','step','foster'); exception when duplicate_object then null; end $$;
do $$ begin create type date_precision as enum ('exact','approx','before','after'); exception when duplicate_object then null; end $$;
do $$ begin create type member_role as enum ('owner','editor','viewer'); exception when duplicate_object then null; end $$;
do $$ begin create type member_status as enum ('pending','active'); exception when duplicate_object then null; end $$;
do $$ begin create type sex as enum ('m','f','x'); exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Tabellen
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

create table if not exists family_members (
  family_id      uuid not null references families on delete cascade,
  profile_id     uuid not null references profiles on delete cascade,
  role           member_role not null default 'viewer',
  status         member_status not null default 'pending',
  self_person_id uuid,  -- FK toegevoegd na persons
  created_at     timestamptz not null default now(),
  primary key (family_id, profile_id)
);

create table if not exists family_invites (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families on delete cascade,
  token      uuid not null default gen_random_uuid(),  -- deelbare link
  role       member_role not null default 'viewer',
  created_by uuid references profiles,
  expires_at timestamptz,
  revoked    boolean not null default false,
  created_at timestamptz not null default now(),
  unique (token)
);

create table if not exists places (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  lat         double precision,
  lon         double precision,
  wikidata_id text
);

create table if not exists persons (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references families on delete cascade,
  given_names      text[] not null default '{}',
  family_name      text,
  display_name     text,
  sex              sex,
  birth_year       int, birth_month int, birth_day int, birth_precision date_precision,
  birth_place_id   uuid references places,
  death_year       int, death_month int, death_day int, death_precision date_precision,
  death_place_id   uuid references places,
  visibility       visibility not null default 'family',
  field_visibility jsonb not null default '{}'::jsonb,
  fully_hidden     boolean not null default false,  -- §3: nucleair, alleen door persoon zelf
  managed_by       uuid references profiles,
  created_by       uuid references profiles,
  wikidata_id      text,
  notes            text,
  created_at       timestamptz not null default now()
);

-- self_person_id FK (persons bestaat nu)
do $$ begin
  alter table family_members
    add constraint family_members_self_person_fk
    foreign key (self_person_id) references persons on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists residences (
  id        uuid primary key default gen_random_uuid(),
  person_id uuid not null references persons on delete cascade,
  place_id  uuid not null references places,
  from_year int,
  to_year   int
);

-- §9: bestaan en detail apart; per-kant prominentie (gedrag later).
create table if not exists unions (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references families on delete cascade,
  partner_a           uuid not null references persons on delete cascade,
  partner_b           uuid not null references persons on delete cascade,
  type                union_type not null default 'marriage',
  start_year int, start_month int, start_day int,
  end_year int, end_month int, end_day int, end_reason union_end_reason,
  existence_visibility visibility not null default 'family',
  detail_visibility    visibility not null default 'family',
  surface_from_a       boolean not null default true,
  surface_from_b       boolean not null default true
);

create table if not exists parent_links (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references families on delete cascade,
  parent_id           uuid not null references persons on delete cascade,
  child_id            uuid not null references persons on delete cascade,
  role                parent_role not null default 'biological',
  union_id            uuid references unions on delete set null,
  start_year          int,
  existence_visibility visibility not null default 'family',
  detail_visibility    visibility not null default 'family',
  surface_from_parent  boolean not null default true,
  surface_from_child   boolean not null default true
);

-- §9: toestemmingsverzoek om het bestaan van een relatie te verbergen.
-- Voorwaartscompatibel: tabel staat klaar, gedrag (gating) komt later.
create table if not exists relationship_existence_requests (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references families on delete cascade,
  relationship_kind text not null check (relationship_kind in ('union','parent_link')),
  relationship_id   uuid not null,
  requested_by      uuid references profiles,
  status            text not null default 'pending' check (status in ('pending','approved','denied')),
  responded_by      uuid references profiles,
  created_at        timestamptz not null default now(),
  responded_at      timestamptz
);

-- Indexen voor traversal/joins
create index if not exists idx_persons_family       on persons (family_id);
create index if not exists idx_parent_links_parent  on parent_links (parent_id);
create index if not exists idx_parent_links_child   on parent_links (child_id);
create index if not exists idx_unions_a             on unions (partner_a);
create index if not exists idx_unions_b             on unions (partner_b);
create index if not exists idx_members_profile      on family_members (profile_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Helper-functies (SECURITY DEFINER → bypassen RLS, voorkomen recursie)
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.is_member(p_family uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from family_members
    where family_id = p_family and profile_id = auth.uid() and status = 'active');
$$;

create or replace function public.is_owner(p_family uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from family_members
    where family_id = p_family and profile_id = auth.uid() and status = 'active' and role = 'owner');
$$;

create or replace function public.role_in_family(p_family uuid)
returns member_role language sql security definer stable set search_path = public as $$
  select role from family_members
    where family_id = p_family and profile_id = auth.uid() and status = 'active';
$$;

create or replace function public.shares_family_with(p_profile uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from family_members a join family_members b on a.family_id = b.family_id
    where a.profile_id = auth.uid() and a.status = 'active'
      and b.profile_id = p_profile and b.status = 'active');
$$;

create or replace function public.is_owner_of_person(p_person uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from persons p
    where p.id = p_person and public.is_owner(p.family_id));
$$;

create or replace function public.can_manage_person(p_person uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from persons p
    where p.id = p_person and (p.managed_by = auth.uid() or public.is_owner(p.family_id)));
$$;

create or replace function public.is_self(p_person uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from family_members
    where self_person_id = p_person and profile_id = auth.uid() and status = 'active');
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Triggers: profiel bij signup, maker wordt owner van nieuwe familie
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_new_family()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    insert into public.family_members (family_id, profile_id, role, status)
    values (new.id, auth.uid(), 'owner', 'active')
    on conflict do nothing;
  end if;
  return new;
end; $$;

drop trigger if exists on_family_created on families;
create trigger on_family_created
  after insert on families
  for each row execute function public.handle_new_family();

-- ─────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────
alter table families        enable row level security;
alter table profiles        enable row level security;
alter table family_members  enable row level security;
alter table family_invites  enable row level security;
alter table places          enable row level security;
alter table persons         enable row level security;
alter table residences      enable row level security;
alter table unions          enable row level security;
alter table parent_links    enable row level security;
alter table relationship_existence_requests enable row level security;

-- families
drop policy if exists families_select on families;
create policy families_select on families for select using (public.is_member(id));
drop policy if exists families_insert on families;
create policy families_insert on families for insert with check (auth.uid() is not null);
drop policy if exists families_update on families;
create policy families_update on families for update using (public.is_owner(id));
drop policy if exists families_delete on families;
create policy families_delete on families for delete using (public.is_owner(id));

-- profiles
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select using (id = auth.uid() or public.shares_family_with(id));
drop policy if exists profiles_insert on profiles;
create policy profiles_insert on profiles for insert with check (id = auth.uid());
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update using (id = auth.uid());

-- family_members
drop policy if exists members_select on family_members;
create policy members_select on family_members for select using (public.is_member(family_id));
drop policy if exists members_insert on family_members;
create policy members_insert on family_members for insert with check (public.is_owner(family_id));
drop policy if exists members_update on family_members;
create policy members_update on family_members for update using (public.is_owner(family_id));
drop policy if exists members_delete on family_members;
create policy members_delete on family_members for delete using (public.is_owner(family_id));

-- family_invites
drop policy if exists invites_select on family_invites;
create policy invites_select on family_invites for select using (public.is_member(family_id));
drop policy if exists invites_insert on family_invites;
create policy invites_insert on family_invites for insert
  with check (public.role_in_family(family_id) in ('owner','editor') and created_by = auth.uid());
drop policy if exists invites_update on family_invites;
create policy invites_update on family_invites for update
  using (public.is_owner(family_id) or created_by = auth.uid());
drop policy if exists invites_delete on family_invites;
create policy invites_delete on family_invites for delete
  using (public.is_owner(family_id) or created_by = auth.uid());

-- places (niet gevoelig; leesbaar voor iedereen, schrijven door ingelogden)
drop policy if exists places_select on places;
create policy places_select on places for select using (true);
drop policy if exists places_insert on places;
create policy places_insert on places for insert with check (auth.uid() is not null);
drop policy if exists places_update on places;
create policy places_update on places for update using (auth.uid() is not null);

-- persons
drop policy if exists persons_select on persons;
create policy persons_select on persons for select using (
  visibility = 'public'
  or public.can_manage_person(id)
  or public.is_self(id)
  or (public.is_member(family_id) and visibility = 'family' and not fully_hidden)
);
drop policy if exists persons_insert on persons;
create policy persons_insert on persons for insert
  with check (public.role_in_family(family_id) in ('owner','editor') and created_by = auth.uid());
drop policy if exists persons_update on persons;
create policy persons_update on persons for update
  using (public.can_manage_person(id) or public.is_self(id));
drop policy if exists persons_delete on persons;
create policy persons_delete on persons for delete using (public.can_manage_person(id));

-- residences (volgt zichtbaarheid van de persoon)
drop policy if exists residences_select on residences;
create policy residences_select on residences for select
  using (exists (select 1 from persons p where p.id = person_id));
drop policy if exists residences_write on residences;
create policy residences_write on residences for all
  using (public.can_manage_person(person_id))
  with check (public.can_manage_person(person_id));

-- unions (bestaan gated door existence_visibility; detail-maskering in RPC)
drop policy if exists unions_select on unions;
create policy unions_select on unions for select using (
  existence_visibility = 'public'
  or public.can_manage_person(partner_a) or public.can_manage_person(partner_b)
  or (public.is_member(family_id) and existence_visibility = 'family')
);
drop policy if exists unions_write on unions;
create policy unions_write on unions for all
  using (public.can_manage_person(partner_a) or public.can_manage_person(partner_b))
  with check (public.can_manage_person(partner_a) or public.can_manage_person(partner_b));

-- parent_links
drop policy if exists plinks_select on parent_links;
create policy plinks_select on parent_links for select using (
  existence_visibility = 'public'
  or public.can_manage_person(parent_id) or public.can_manage_person(child_id)
  or (public.is_member(family_id) and existence_visibility = 'family')
);
drop policy if exists plinks_write on parent_links;
create policy plinks_write on parent_links for all
  using (public.can_manage_person(parent_id) or public.can_manage_person(child_id))
  with check (public.can_manage_person(parent_id) or public.can_manage_person(child_id));

-- relationship_existence_requests (forward-compatible; leden van de familie)
drop policy if exists rer_select on relationship_existence_requests;
create policy rer_select on relationship_existence_requests for select using (public.is_member(family_id));
drop policy if exists rer_insert on relationship_existence_requests;
create policy rer_insert on relationship_existence_requests for insert with check (public.is_member(family_id));
drop policy if exists rer_update on relationship_existence_requests;
create policy rer_update on relationship_existence_requests for update using (public.is_member(family_id));

-- ─────────────────────────────────────────────────────────────────────────
-- Grants (Data API "auto-expose" staat UIT → expliciet toekennen)
-- RLS blijft de poortwachter; grants maken de tabellen pas bereikbaar.
-- ─────────────────────────────────────────────────────────────────────────
grant usage on schema public to anon, authenticated;

grant select on places, persons, unions, parent_links to anon;  -- publieke rijen (RLS gate)
grant select, insert, update, delete on
  families, profiles, family_members, family_invites, places,
  persons, residences, unions, parent_links, relationship_existence_requests
  to authenticated;

grant execute on function
  public.is_member(uuid), public.is_owner(uuid), public.role_in_family(uuid),
  public.shares_family_with(uuid), public.is_owner_of_person(uuid),
  public.can_manage_person(uuid), public.is_self(uuid)
  to anon, authenticated;
