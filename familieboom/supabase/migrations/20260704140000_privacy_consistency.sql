-- Migratie 28 — Privacymodel consistent (security-review 2026-07-04, punten 5–7).
--
-- 5. Editors zagen privé-relaties: migratie 16 verving in de PERSOONS-leespaden
--    can_manage_person door is_owner_of_person, maar unions/parent_links (RLS
--    én _build_graph) gebruikten nog can_manage_person — sinds migratie 21
--    gelijk aan "owner óf editor". Voortaan: privé-relatie = owner van de
--    familie, of een van de betrokkenen zelf (is_self — nieuw: een lid ziet
--    zijn éígen relatie altijd, ook als viewer).
-- 6. detail_visibility op parent_links werd nergens toegepast: rol (adoptie/
--    stief/pleeg) en startjaar waren altijd zichtbaar zodra het bestaan dat
--    was. Detail wordt nu gemaskeerd zoals bij unions: rol wordt neutraal
--    'biological' + detailHidden:true (de frontend verwacht een rol; de
--    neutrale terugval lekt de adoptie-/stiefstatus niet).
-- 7. fully_hidden deed niet wat het belooft ("nucleair, alleen de persoon
--    zelf"): (a) de owner zag een fully_hidden-persoon gewoon (is_owner_of_
--    person negeerde de vlag), (b) élke owner/editor kon de vlag bij een
--    ander aan- of uitzetten, (c) copy_persons kopieerde de persoon zonder de
--    vlag mee te nemen → weer zichtbaar in de doelboom. Fix: vlag geldt ook
--    voor de owner (alleen is_self doorbreekt hem), een trigger beperkt het
--    wijzigen van de vlag tot de persoon zelf (en bevriest family_id/
--    created_by), en copy_persons slaat fully_hidden-personen over.
-- Plus: relationship_existence_requests-update was voor élk lid; nu alleen
-- aanvrager of owner.
--
-- Idempotent: drop policy if exists / create or replace / drop trigger if exists.

-- ─────────────────────────────────────────────────────────────────────────
-- Leespolicies: personen en relaties
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists persons_select on persons;
create policy persons_select on persons for select using (
  public.is_self(id)
  or (not fully_hidden and (
        visibility = 'public'
        or public.is_owner_of_person(id)
        or (public.is_member(family_id) and visibility = 'family')))
);

drop policy if exists unions_select on unions;
create policy unions_select on unions for select using (
  existence_visibility = 'public'
  or public.is_owner(family_id)
  or public.is_self(partner_a) or public.is_self(partner_b)
  or (public.is_member(family_id) and existence_visibility = 'family')
);

drop policy if exists plinks_select on parent_links;
create policy plinks_select on parent_links for select using (
  existence_visibility = 'public'
  or public.is_owner(family_id)
  or public.is_self(parent_id) or public.is_self(child_id)
  or (public.is_member(family_id) and existence_visibility = 'family')
);

-- ─────────────────────────────────────────────────────────────────────────
-- Kolom-bescherming: fully_hidden alleen door de persoon zelf;
-- family_id/created_by onveranderlijk.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.persons_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.fully_hidden is distinct from old.fully_hidden and not public.is_self(old.id) then
    raise exception 'Alleen de persoon zelf kan volledige verberging wijzigen';
  end if;
  if new.family_id is distinct from old.family_id then
    raise exception 'De familie van een persoon is onveranderlijk';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'De maker van een persoon is onveranderlijk';
  end if;
  return new;
end; $$;

drop trigger if exists persons_guard on persons;
create trigger persons_guard
  before update on persons
  for each row execute function public.persons_guard();

-- ─────────────────────────────────────────────────────────────────────────
-- _build_graph: zelfde structuur als migratie 25 (incl. residences), met
--   * can_full dat fully_hidden ook voor de owner respecteert;
--   * unions/plinks-predicaten op is_owner(family)/is_self i.p.v.
--     can_manage_person;
--   * detail-maskering voor parent_links (rol → 'biological' + detailHidden).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public._build_graph(p_ids uuid[])
returns jsonb language sql security definer stable set search_path = public as $$
with
  v as (
    select p.*,
      (public.is_self(p.id)
        or (not p.fully_hidden and (
              p.visibility = 'public'
              or public.is_owner_of_person(p.id)
              or (public.is_member(p.family_id) and p.visibility = 'family')))
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
        'callName', i.call_name,
        'displayName', i.display_name,
        'nameNative', i.name_native,
        'nickname', i.nickname,
        'preferredName', i.preferred_name,
        'photoPath', i.photo_path,
        'sex', i.sex,
        'residences', coalesce((
          select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
            'id', r.id,
            'place', (select jsonb_strip_nulls(jsonb_build_object('name', pl.name, 'lat', pl.lat, 'lon', pl.lon, 'wikidataId', pl.wikidata_id))
                      from places pl where pl.id = r.place_id),
            'from', case when r.from_year is not null then jsonb_build_object('year', r.from_year) end,
            'to',   case when r.to_year   is not null then jsonb_build_object('year', r.to_year)   end
          )) order by r.from_year nulls last)
          from residences r where r.person_id = i.id
        ), '[]'::jsonb),
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
                    or public.is_owner(u.family_id)
                    or public.is_self(u.partner_a) or public.is_self(u.partner_b)
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
           or public.is_owner(u.family_id)
           or public.is_self(u.partner_a) or public.is_self(u.partner_b)
           or (public.is_member(u.family_id) and u.existence_visibility = 'family'))
  ),
  plinks_json as (
    select coalesce(jsonb_agg(jsonb_strip_nulls(
      jsonb_build_object(
        'id', pl.id,
        'parent', pl.parent_id,
        'child', pl.child_id,
        'unionId', pl.union_id,
        'visibility', pl.existence_visibility
      )
      || case when (pl.detail_visibility = 'public'
                    or public.is_owner(pl.family_id)
                    or public.is_self(pl.parent_id) or public.is_self(pl.child_id)
                    or (public.is_member(pl.family_id) and pl.detail_visibility = 'family'))
         then jsonb_strip_nulls(jsonb_build_object(
              'role', pl.role,
              'start', case when pl.start_year is not null then jsonb_build_object('year', pl.start_year) end
            ))
         else jsonb_build_object('role', 'biological', 'detailHidden', true) end
    )), '[]'::jsonb) as arr
    from parent_links pl
    where pl.parent_id in (select id from ids) and pl.child_id in (select id from ids)
      and (pl.existence_visibility = 'public'
           or public.is_owner(pl.family_id)
           or public.is_self(pl.parent_id) or public.is_self(pl.child_id)
           or (public.is_member(pl.family_id) and pl.existence_visibility = 'family'))
  )
select jsonb_build_object(
  'persons',     (select arr from persons_json),
  'unions',      (select arr from unions_json),
  'parentLinks', (select arr from plinks_json)
);
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- copy_persons: fully_hidden-personen gaan niet mee (ook niet als anchor) —
-- wie zichzelf nucleair verborg, kan niet via een kopie in een andere boom
-- opnieuw zichtbaar worden. Verder identiek aan migratie 20.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.copy_persons(
  p_source uuid, p_target uuid, p_ids uuid[], p_anchors jsonb default '{}'::jsonb
) returns int language plpgsql security definer set search_path = public as $$
declare v_count int := 0;
begin
  if not public.is_owner(p_target) then
    raise exception 'Geen owner van de doelfamilie';
  end if;
  if not public.is_owner(p_source) then
    raise exception 'Geen owner van de bronfamilie';
  end if;
  if p_source = p_target then
    raise exception 'Bron en doel zijn gelijk';
  end if;

  create temporary table _pmap (old_id uuid primary key, new_id uuid, is_new boolean) on commit drop;

  insert into _pmap (old_id, new_id, is_new)
  select s.id, gen_random_uuid(), true
  from persons s
  where s.family_id = p_source and s.id = any(p_ids) and not s.fully_hidden;

  insert into _pmap (old_id, new_id, is_new)
  select (kv.key)::uuid, (kv.value)::uuid, false
  from jsonb_each_text(p_anchors) kv
  where exists (select 1 from persons sp
                where sp.id = (kv.key)::uuid and sp.family_id = p_source and not sp.fully_hidden)
    and exists (select 1 from persons tp where tp.id = (kv.value)::uuid and tp.family_id = p_target)
    and not exists (select 1 from _pmap m where m.old_id = (kv.key)::uuid);

  insert into persons (
    id, family_id, given_names, family_name, call_name, display_name, sex,
    birth_year, birth_month, birth_day, birth_precision, birth_place_id,
    death_year, death_month, death_day, death_precision, death_place_id,
    visibility, wikidata_id, notes, created_by, managed_by
  )
  select m.new_id, p_target, s.given_names, s.family_name, s.call_name, s.display_name, s.sex,
    s.birth_year, s.birth_month, s.birth_day, s.birth_precision, s.birth_place_id,
    s.death_year, s.death_month, s.death_day, s.death_precision, s.death_place_id,
    s.visibility, s.wikidata_id, s.notes, auth.uid(), auth.uid()
  from persons s join _pmap m on m.old_id = s.id
  where m.is_new;
  get diagnostics v_count = row_count;

  create temporary table _umap (old_id uuid primary key, new_id uuid) on commit drop;
  insert into _umap (old_id, new_id)
  select u.id, gen_random_uuid()
  from unions u
  join _pmap ma on ma.old_id = u.partner_a
  join _pmap mb on mb.old_id = u.partner_b
  where u.family_id = p_source
    and (ma.is_new or mb.is_new)
    and not exists (
      select 1 from unions e
      where e.family_id = p_target
        and ((e.partner_a = ma.new_id and e.partner_b = mb.new_id)
          or (e.partner_a = mb.new_id and e.partner_b = ma.new_id))
    );

  insert into unions (
    id, family_id, partner_a, partner_b, type,
    start_year, start_month, start_day, end_year, end_month, end_day, end_reason,
    existence_visibility, detail_visibility, surface_from_a, surface_from_b
  )
  select um.new_id, p_target, ma.new_id, mb.new_id, u.type,
    u.start_year, u.start_month, u.start_day, u.end_year, u.end_month, u.end_day, u.end_reason,
    u.existence_visibility, u.detail_visibility, u.surface_from_a, u.surface_from_b
  from unions u
  join _umap um on um.old_id = u.id
  join _pmap ma on ma.old_id = u.partner_a
  join _pmap mb on mb.old_id = u.partner_b;

  insert into parent_links (
    family_id, parent_id, child_id, role, union_id, start_year,
    existence_visibility, detail_visibility, surface_from_parent, surface_from_child
  )
  select p_target, mp.new_id, mc.new_id, pl.role, um.new_id, pl.start_year,
    pl.existence_visibility, pl.detail_visibility, pl.surface_from_parent, pl.surface_from_child
  from parent_links pl
  join _pmap mp on mp.old_id = pl.parent_id
  join _pmap mc on mc.old_id = pl.child_id
  left join _umap um on um.old_id = pl.union_id
  where pl.family_id = p_source
    and (mp.is_new or mc.is_new)
    and not exists (
      select 1 from parent_links e
      where e.family_id = p_target and e.parent_id = mp.new_id and e.child_id = mc.new_id
    );

  return v_count;
end; $$;

grant execute on function public.copy_persons(uuid, uuid, uuid[], jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- relationship_existence_requests: afhandelen alleen door aanvrager of owner
-- (was: elk lid kon andermans verzoeken updaten). Tabel is nog ongebruikt;
-- dit dicht 'm vóórdat het gedrag live gaat.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists rer_update on relationship_existence_requests;
create policy rer_update on relationship_existence_requests for update
  using (requested_by = auth.uid() or public.is_owner(family_id));
