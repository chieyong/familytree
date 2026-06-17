-- Migratie 12 — gekoppelde bomen (fase 1: brug leggen). Spiegel-model: een
-- persoon bestaat in beide bomen; een tree_link zegt "dezelfde persoon". De
-- brug ontstaat via een koppel-code: de owner van familie B maakt een code voor
-- één persoon (de spiegel in B); de owner van familie A accepteert die op zijn
-- eigen persoon. Beide owners handelen = tweezijdige toestemming → link actief.

create table if not exists bridge_invites (
  token      uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families on delete cascade,  -- uitnodigende familie (B)
  person_id  uuid not null references persons  on delete cascade,  -- spiegel-persoon in B
  created_by uuid references profiles,
  created_at timestamptz not null default now()
);

create table if not exists tree_links (
  id         uuid primary key default gen_random_uuid(),
  family_a   uuid not null references families on delete cascade,
  person_a   uuid not null references persons  on delete cascade,
  family_b   uuid not null references families on delete cascade,
  person_b   uuid not null references persons  on delete cascade,
  created_by uuid references profiles,
  created_at timestamptz not null default now()
);

create index if not exists idx_tree_links_a on tree_links (person_a);
create index if not exists idx_tree_links_b on tree_links (person_b);

-- RLS: leden van een betrokken familie mogen de brug zien; muteren gaat alleen
-- via de RPC's hieronder (SECURITY DEFINER), dus geen schrijf-policies.
alter table tree_links enable row level security;
alter table bridge_invites enable row level security;
grant select on tree_links, bridge_invites to authenticated;

drop policy if exists tree_links_select on tree_links;
create policy tree_links_select on tree_links for select
  using (public.is_member(family_a) or public.is_member(family_b));

drop policy if exists bridge_invites_select on bridge_invites;
create policy bridge_invites_select on bridge_invites for select
  using (public.is_member(family_id));

-- Owner van B maakt een koppel-code voor één persoon in zijn boom.
create or replace function public.create_bridge_invite(p_family uuid, p_person uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_token uuid;
begin
  if not public.is_owner(p_family) then
    raise exception 'Alleen de beheerder mag een koppel-code maken';
  end if;
  if not exists (select 1 from persons where id = p_person and family_id = p_family) then
    raise exception 'Persoon hoort niet bij deze familie';
  end if;
  insert into bridge_invites (family_id, person_id, created_by)
    values (p_family, p_person, auth.uid())
    returning token into v_token;
  return v_token;
end; $$;

-- Owner van A accepteert de code op zijn eigen persoon → brug wordt actief.
create or replace function public.accept_bridge_invite(p_token uuid, p_family_a uuid, p_person_a uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_inv bridge_invites;
begin
  if not public.is_owner(p_family_a) then
    raise exception 'Alleen de beheerder mag een brug accepteren';
  end if;
  select * into v_inv from bridge_invites where token = p_token;
  if v_inv.token is null then
    raise exception 'Ongeldige of gebruikte koppel-code';
  end if;
  if v_inv.family_id = p_family_a then
    raise exception 'Je kunt een familie niet aan zichzelf koppelen';
  end if;
  if not exists (select 1 from persons where id = p_person_a and family_id = p_family_a) then
    raise exception 'Persoon hoort niet bij deze familie';
  end if;
  if exists (select 1 from tree_links
             where (person_a = p_person_a and person_b = v_inv.person_id)
                or (person_a = v_inv.person_id and person_b = p_person_a)) then
    raise exception 'Deze brug bestaat al';
  end if;

  insert into tree_links (family_a, person_a, family_b, person_b, created_by)
    values (p_family_a, p_person_a, v_inv.family_id, v_inv.person_id, auth.uid());
  delete from bridge_invites where token = p_token;

  return jsonb_build_object('familyB', v_inv.family_id, 'personB', v_inv.person_id);
end; $$;

grant execute on function public.create_bridge_invite(uuid, uuid) to authenticated;
grant execute on function public.accept_bridge_invite(uuid, uuid, uuid) to authenticated;

-- _build_graph opnieuw, nu met een bridge-veld per zichtbare persoon (de andere
-- kant van een actieve tree_link: familyId, familyName, personId).
create or replace function public._build_graph(p_ids uuid[])
returns jsonb language sql security definer stable set search_path = public as $$
with
  v as (
    select p.*,
      (p.visibility = 'public'
        or public.can_manage_person(p.id)
        or public.is_self(p.id)
        or (public.is_member(p.family_id) and p.visibility = 'family' and not p.fully_hidden)
      ) as can_full,
      public.is_member(p.family_id) as is_mem
    from persons p
    where p.id = any(p_ids)
  ),
  incl as (
    select *, (not can_full) as hidden
    from v
    where can_full or (is_mem and not fully_hidden)
  ),
  ids as (select id from incl),
  persons_json as (
    select coalesce(jsonb_agg(
      case when not i.hidden then jsonb_strip_nulls(jsonb_build_object(
        'id', i.id,
        'givenNames', to_jsonb(i.given_names),
        'familyName', i.family_name,
        'displayName', i.display_name,
        'nameNative', i.name_native,
        'nickname', i.nickname,
        'photoPath', i.photo_path,
        'sex', i.sex,
        'residences', '[]'::jsonb,
        'birth', case when i.birth_year is not null or i.birth_place_id is not null
          then jsonb_strip_nulls(jsonb_build_object(
            'date', case when i.birth_year is not null
              then jsonb_strip_nulls(jsonb_build_object('year', i.birth_year, 'month', i.birth_month, 'day', i.birth_day)) end,
            'place', (select jsonb_strip_nulls(jsonb_build_object('name', pl.name, 'lat', pl.lat, 'lon', pl.lon, 'wikidataId', pl.wikidata_id))
                      from places pl where pl.id = i.birth_place_id)
          )) end,
        'death', case when i.death_year is not null or i.death_place_id is not null
          then jsonb_strip_nulls(jsonb_build_object(
            'date', case when i.death_year is not null
              then jsonb_strip_nulls(jsonb_build_object('year', i.death_year, 'month', i.death_month, 'day', i.death_day)) end,
            'place', (select jsonb_strip_nulls(jsonb_build_object('name', pl.name, 'lat', pl.lat, 'lon', pl.lon, 'wikidataId', pl.wikidata_id))
                      from places pl where pl.id = i.death_place_id)
          )) end,
        'bridge', (
          select jsonb_build_object('familyId', b.fam, 'familyName', f.name, 'personId', b.per)
          from (
            select case when t.person_a = i.id then t.family_b else t.family_a end as fam,
                   case when t.person_a = i.id then t.person_b else t.person_a end as per
            from tree_links t
            where t.person_a = i.id or t.person_b = i.id
            limit 1
          ) b join families f on f.id = b.fam
        ),
        'visibility', i.visibility
      ))
      else jsonb_build_object(
        'id', i.id, 'hidden', true,
        'givenNames', jsonb_build_array('Verborgen'),
        'displayName', 'Verborgen persoon',
        'residences', '[]'::jsonb,
        'visibility', 'private'
      ) end
    ), '[]'::jsonb) as arr
    from incl i
  ),
  unions_json as (
    select coalesce(jsonb_agg(jsonb_strip_nulls(
      jsonb_build_object(
        'id', u.id,
        'partners', jsonb_build_array(u.partner_a, u.partner_b),
        'visibility', u.existence_visibility
      )
      || case when (u.detail_visibility = 'public'
                    or public.can_manage_person(u.partner_a) or public.can_manage_person(u.partner_b)
                    or (public.is_member(u.family_id) and u.detail_visibility = 'family'))
         then jsonb_strip_nulls(jsonb_build_object(
              'type', u.type,
              'start', case when u.start_year is not null
                then jsonb_strip_nulls(jsonb_build_object('year', u.start_year, 'month', u.start_month, 'day', u.start_day)) end,
              'end', case when u.end_reason is not null or u.end_year is not null
                then jsonb_strip_nulls(jsonb_build_object(
                  'date', case when u.end_year is not null
                    then jsonb_strip_nulls(jsonb_build_object('year', u.end_year, 'month', u.end_month, 'day', u.end_day)) end,
                  'reason', u.end_reason)) end
            ))
         else jsonb_build_object('detailHidden', true) end
    )), '[]'::jsonb) as arr
    from unions u
    where u.partner_a in (select id from ids) and u.partner_b in (select id from ids)
      and (u.existence_visibility = 'public'
           or public.can_manage_person(u.partner_a) or public.can_manage_person(u.partner_b)
           or (public.is_member(u.family_id) and u.existence_visibility = 'family'))
  ),
  plinks_json as (
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', pl.id,
      'parent', pl.parent_id,
      'child', pl.child_id,
      'role', pl.role,
      'unionId', pl.union_id,
      'start', case when pl.start_year is not null then jsonb_build_object('year', pl.start_year) end,
      'visibility', pl.existence_visibility
    ))), '[]'::jsonb) as arr
    from parent_links pl
    where pl.parent_id in (select id from ids) and pl.child_id in (select id from ids)
      and (pl.existence_visibility = 'public'
           or public.can_manage_person(pl.parent_id) or public.can_manage_person(pl.child_id)
           or (public.is_member(pl.family_id) and pl.existence_visibility = 'family'))
  )
select jsonb_build_object(
  'persons',     (select arr from persons_json),
  'unions',      (select arr from unions_json),
  'parentLinks', (select arr from plinks_json)
);
$$;
