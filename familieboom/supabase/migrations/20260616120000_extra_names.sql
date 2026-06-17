-- Migratie 6 — Extra naamvelden, cultuur-neutraal: naam in eigen schrift
-- (Chinees, Cyrillisch, Arabisch…) en bijnaam/roepnaam. Plus _build_graph
-- die de velden meegeeft.

alter table persons add column if not exists name_native text;
alter table persons add column if not exists nickname text;

-- _build_graph opnieuw, nu met nameNative / nickname in de persoon-JSON.
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
