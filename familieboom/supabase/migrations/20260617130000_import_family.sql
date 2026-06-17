-- Migratie 8 — import_family: bulk-import van een platte template in één keer.
-- De client levert personen met een zelfgekozen sleutel (key) plus ouder-kind-
-- en partner-relaties die naar die sleutels verwijzen. De functie zet de
-- sleutels om naar UUID's en voegt alles atomair toe (één transactie: bij een
-- fout rolt de hele import terug). Alleen de eigenaar van de familie mag dit.

create or replace function public.import_family(p_family uuid, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_map jsonb := '{}'::jsonb;   -- sleutel → nieuw uuid
  v_rec jsonb;
  v_id  uuid;
  v_key text;
  n_persons int := 0;
  n_links   int := 0;
  n_unions  int := 0;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if not public.is_owner(p_family) then
    raise exception 'Alleen de beheerder van deze familie mag importeren';
  end if;

  -- 1. Personen
  for v_rec in select * from jsonb_array_elements(coalesce(p_data->'persons', '[]'::jsonb)) loop
    v_key := v_rec->>'key';
    if v_key is null or v_key = '' then
      raise exception 'Persoon zonder sleutel (kolom id)';
    end if;
    if v_map ? v_key then
      raise exception 'Dubbele sleutel: %', v_key;
    end if;
    insert into persons (family_id, given_names, family_name, name_native, nickname,
                         sex, birth_year, death_year, visibility, managed_by, created_by)
      values (
        p_family,
        coalesce((select array_agg(x) from jsonb_array_elements_text(v_rec->'givenNames') x), '{}'),
        nullif(v_rec->>'familyName', ''),
        nullif(v_rec->>'nameNative', ''),
        nullif(v_rec->>'nickname', ''),
        (nullif(v_rec->>'sex', ''))::sex,
        (v_rec->>'birthYear')::int,
        (v_rec->>'deathYear')::int,
        'family', v_uid, v_uid)
      returning id into v_id;
    v_map := v_map || jsonb_build_object(v_key, v_id);
    n_persons := n_persons + 1;
  end loop;

  -- 2. Ouder-kind
  for v_rec in select * from jsonb_array_elements(coalesce(p_data->'parentLinks', '[]'::jsonb)) loop
    if not (v_map ? (v_rec->>'parent')) then
      raise exception 'Onbekende ouder-sleutel: %', v_rec->>'parent';
    end if;
    if not (v_map ? (v_rec->>'child')) then
      raise exception 'Onbekende kind-sleutel: %', v_rec->>'child';
    end if;
    insert into parent_links (family_id, parent_id, child_id, existence_visibility, detail_visibility)
      values (p_family, (v_map->>(v_rec->>'parent'))::uuid, (v_map->>(v_rec->>'child'))::uuid, 'family', 'family');
    n_links := n_links + 1;
  end loop;

  -- 3. Partners
  for v_rec in select * from jsonb_array_elements(coalesce(p_data->'unions', '[]'::jsonb)) loop
    if not (v_map ? (v_rec->>'a')) then
      raise exception 'Onbekende partner-sleutel: %', v_rec->>'a';
    end if;
    if not (v_map ? (v_rec->>'b')) then
      raise exception 'Onbekende partner-sleutel: %', v_rec->>'b';
    end if;
    insert into unions (family_id, partner_a, partner_b, type, existence_visibility, detail_visibility)
      values (p_family, (v_map->>(v_rec->>'a'))::uuid, (v_map->>(v_rec->>'b'))::uuid, 'marriage', 'family', 'family');
    n_unions := n_unions + 1;
  end loop;

  return jsonb_build_object('persons', n_persons, 'parentLinks', n_links, 'unions', n_unions);
end; $$;

grant execute on function public.import_family(uuid, jsonb) to authenticated;
