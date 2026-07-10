-- Migratie 34 — Import verrijkt: roepnaam, meerdere bijnamen, zichtbaarheid,
-- en plaatsen (geboorte/overlijden/woonplaatsen). De client geocodeert de
-- plaatsnamen en levert coördinaten mee; deze functie upsert de places en zet
-- birth_place_id/death_place_id + residences. Zo rondt een export-CSV volledig
-- terug (op de platte-formaat-grenzen na: meerdere ouderparen/partners).
--
-- Idempotent: create or replace.

-- Plaats opzoeken-of-aanmaken (server-side variant van de client-upsertPlace:
-- dedup op naam + coördinaten binnen ~0.0015°). Lege naam → null.
create or replace function public._import_place(
  p_name text, p_lat double precision, p_lon double precision, p_wikidata text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_name is null or p_name = '' then
    return null;
  end if;
  if p_lat is not null and p_lon is not null then
    select id into v_id from places
      where name = p_name and lat is not null and lon is not null
        and abs(lat - p_lat) < 0.0015 and abs(lon - p_lon) < 0.0015
      limit 1;
  else
    select id into v_id from places where name = p_name limit 1;
  end if;
  if v_id is not null then
    return v_id;
  end if;
  insert into places (name, lat, lon, wikidata_id)
    values (p_name, p_lat, p_lon, nullif(p_wikidata, ''))
    returning id into v_id;
  return v_id;
end; $$;

create or replace function public.import_family(p_family uuid, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_map jsonb := '{}'::jsonb;   -- sleutel → uuid (bestaand + nieuw)
  v_rec jsonb;
  v_res jsonb;
  v_ext record;
  v_id  uuid;
  v_bp  uuid;
  v_dp  uuid;
  v_rp  uuid;
  v_pa  uuid;
  v_ch  uuid;
  v_a   uuid;
  v_b   uuid;
  v_key text;
  n_persons int := 0;
  n_updated int := 0;
  n_links   int := 0;
  n_unions  int := 0;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if not public.is_owner(p_family) then
    raise exception 'Alleen de beheerder van deze familie mag importeren';
  end if;

  -- 0. Bestaande personen vooraf in de map (en controleren dat ze bij deze
  --    familie horen — anders kun je over families heen koppelen).
  for v_ext in select key, value from jsonb_each_text(coalesce(p_data->'existing', '{}'::jsonb)) loop
    if not exists (select 1 from persons p where p.id = (v_ext.value)::uuid and p.family_id = p_family) then
      raise exception 'Bestaand persoon "%" hoort niet bij deze familie', v_ext.value;
    end if;
    v_map := v_map || jsonb_build_object(v_ext.key, v_ext.value);
  end loop;

  -- 1. Personen. Rij met db_id → bestaande bijwerken; zonder → nieuwe aanmaken.
  --    (roepnaam, bijnamen, zichtbaarheid, plaatsen, woonplaatsen worden meegenomen.)
  for v_rec in select * from jsonb_array_elements(coalesce(p_data->'persons', '[]'::jsonb)) loop
    v_key := v_rec->>'key';
    if v_key is null or v_key = '' then
      raise exception 'Persoon zonder sleutel (kolom id)';
    end if;
    if v_map ? v_key then
      raise exception 'Dubbele sleutel: %', v_key;
    end if;

    v_bp := public._import_place(
      v_rec->'birthPlace'->>'name',
      (v_rec->'birthPlace'->>'lat')::double precision,
      (v_rec->'birthPlace'->>'lon')::double precision,
      v_rec->'birthPlace'->>'wikidataId');
    v_dp := public._import_place(
      v_rec->'deathPlace'->>'name',
      (v_rec->'deathPlace'->>'lat')::double precision,
      (v_rec->'deathPlace'->>'lon')::double precision,
      v_rec->'deathPlace'->>'wikidataId');

    if nullif(v_rec->>'dbId', '') is not null then
      -- Bestaande persoon bijwerken (moet tot deze familie horen).
      v_id := (v_rec->>'dbId')::uuid;
      if not exists (select 1 from persons p where p.id = v_id and p.family_id = p_family) then
        raise exception 'Bestaand persoon "%" hoort niet bij deze familie', v_id;
      end if;
      update persons set
        given_names    = coalesce((select array_agg(x) from jsonb_array_elements_text(v_rec->'givenNames') x), '{}'),
        family_name    = nullif(v_rec->>'familyName', ''),
        name_native    = nullif(v_rec->>'nameNative', ''),
        call_name      = nullif(v_rec->>'callName', ''),
        nickname       = (array(select jsonb_array_elements_text(v_rec->'nicknames')))[1],
        nicknames      = array(select jsonb_array_elements_text(v_rec->'nicknames')),
        sex            = (nullif(v_rec->>'sex', ''))::sex,
        birth_year     = (v_rec->>'birthYear')::int,
        death_year     = (v_rec->>'deathYear')::int,
        birth_place_id = v_bp,
        death_place_id = v_dp,
        visibility     = coalesce(nullif(v_rec->>'visibility', ''), 'family')::visibility
        where id = v_id;
      -- Woonplaatsen zijn autoritair vanuit het CSV: vervang de set.
      delete from residences where person_id = v_id;
      n_updated := n_updated + 1;
    else
      insert into persons (
        family_id, given_names, family_name, name_native, call_name, nickname, nicknames,
        sex, birth_year, death_year, birth_place_id, death_place_id, visibility, managed_by, created_by)
        values (
          p_family,
          coalesce((select array_agg(x) from jsonb_array_elements_text(v_rec->'givenNames') x), '{}'),
          nullif(v_rec->>'familyName', ''),
          nullif(v_rec->>'nameNative', ''),
          nullif(v_rec->>'callName', ''),
          -- scalar nickname gesynchroniseerd op de eerste (achterwaartse compat)
          (array(select jsonb_array_elements_text(v_rec->'nicknames')))[1],
          array(select jsonb_array_elements_text(v_rec->'nicknames')),
          (nullif(v_rec->>'sex', ''))::sex,
          (v_rec->>'birthYear')::int,
          (v_rec->>'deathYear')::int,
          v_bp, v_dp,
          coalesce(nullif(v_rec->>'visibility', ''), 'family')::visibility,
          v_uid, v_uid)
        returning id into v_id;
      n_persons := n_persons + 1;
    end if;

    v_map := v_map || jsonb_build_object(v_key, v_id);

    -- Woonplaatsen (bij update is de bestaande set hierboven al gewist).
    for v_res in select * from jsonb_array_elements(coalesce(v_rec->'residences', '[]'::jsonb)) loop
      v_rp := public._import_place(
        v_res->>'name',
        (v_res->>'lat')::double precision,
        (v_res->>'lon')::double precision,
        v_res->>'wikidataId');
      if v_rp is not null then
        insert into residences (person_id, place_id, from_year)
          values (v_id, v_rp, (v_res->>'fromYear')::int);
      end if;
    end loop;
  end loop;

  -- 2. Ouder-kind (bestaande band niet dupliceren → re-import voegt alleen nieuwe toe).
  for v_rec in select * from jsonb_array_elements(coalesce(p_data->'parentLinks', '[]'::jsonb)) loop
    if not (v_map ? (v_rec->>'parent')) then
      raise exception 'Onbekende ouder-sleutel: %', v_rec->>'parent';
    end if;
    if not (v_map ? (v_rec->>'child')) then
      raise exception 'Onbekende kind-sleutel: %', v_rec->>'child';
    end if;
    v_pa := (v_map->>(v_rec->>'parent'))::uuid;
    v_ch := (v_map->>(v_rec->>'child'))::uuid;
    if not exists (
      select 1 from parent_links e
      where e.family_id = p_family and e.parent_id = v_pa and e.child_id = v_ch
    ) then
      insert into parent_links (family_id, parent_id, child_id, existence_visibility, detail_visibility)
        values (p_family, v_pa, v_ch, 'family', 'family');
      n_links := n_links + 1;
    end if;
  end loop;

  -- 3. Partners (bestaande union niet dupliceren, ongeacht partner-volgorde).
  for v_rec in select * from jsonb_array_elements(coalesce(p_data->'unions', '[]'::jsonb)) loop
    if not (v_map ? (v_rec->>'a')) then
      raise exception 'Onbekende partner-sleutel: %', v_rec->>'a';
    end if;
    if not (v_map ? (v_rec->>'b')) then
      raise exception 'Onbekende partner-sleutel: %', v_rec->>'b';
    end if;
    v_a := (v_map->>(v_rec->>'a'))::uuid;
    v_b := (v_map->>(v_rec->>'b'))::uuid;
    if not exists (
      select 1 from unions e
      where e.family_id = p_family
        and ((e.partner_a = v_a and e.partner_b = v_b) or (e.partner_a = v_b and e.partner_b = v_a))
    ) then
      insert into unions (family_id, partner_a, partner_b, type, existence_visibility, detail_visibility)
        values (p_family, v_a, v_b, 'marriage', 'family', 'family');
      n_unions := n_unions + 1;
    end if;
  end loop;

  return jsonb_build_object('persons', n_persons, 'updated', n_updated, 'parentLinks', n_links, 'unions', n_unions);
end; $$;

grant execute on function public.import_family(uuid, jsonb) to authenticated;
