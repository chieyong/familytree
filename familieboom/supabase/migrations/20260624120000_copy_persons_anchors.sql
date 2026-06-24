-- Migratie 20 — Personen kopiëren mét aanknopen (copy_persons + anchors).
--
-- Uitbreiding op migratie 19: naast de te kopiëren personen (p_ids) kan de
-- aanroeper een ANCHORS-map meegeven: { bron_persoon_id → bestaand_doel_persoon_id }.
-- Een anchor is iemand die in BEIDE bomen voorkomt (herkend op naam+geboortejaar
-- in de UI). Voor een anchor wordt GÉÉN nieuw record gemaakt; relaties tussen een
-- gekopieerde persoon en een anchor worden aan het bestaande doel-knooppunt
-- gehangen. Zo verschijnt een kopie niet meer "los" maar verbonden met de boom.
--
-- Gekopieerd worden relaties waarvan beide eindpunten bekend zijn (geselecteerd
-- óf anchor) én minstens één eindpunt nieuw is (anchor↔anchor laten we met rust).
-- Reeds bestaande relaties in de doelboom worden niet gedupliceerd.
--
-- Rechten: owner van bron én doel. Idempotent: drop oude signatuur + create.

drop function if exists public.copy_persons(uuid, uuid, uuid[]);

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

  -- old_id → new_id; is_new = true voor te kopiëren personen, false voor anchors.
  create temporary table _pmap (old_id uuid primary key, new_id uuid, is_new boolean) on commit drop;

  insert into _pmap (old_id, new_id, is_new)
  select s.id, gen_random_uuid(), true
  from persons s
  where s.family_id = p_source and s.id = any(p_ids);

  -- Anchors: bron-persoon → bestaand doel-persoon. Beide moeten in hun familie
  -- bestaan; geselecteerde personen winnen (geen anchor-override).
  insert into _pmap (old_id, new_id, is_new)
  select (kv.key)::uuid, (kv.value)::uuid, false
  from jsonb_each_text(p_anchors) kv
  where exists (select 1 from persons sp where sp.id = (kv.key)::uuid and sp.family_id = p_source)
    and exists (select 1 from persons tp where tp.id = (kv.value)::uuid and tp.family_id = p_target)
    and not exists (select 1 from _pmap m where m.old_id = (kv.key)::uuid);

  -- Alleen de nieuwe (geselecteerde) personen daadwerkelijk invoegen.
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

  -- Huwelijken: beide eindpunten bekend, minstens één nieuw, nog niet aanwezig.
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

  -- Ouder-kindbanden: idem; union_id omgehangen indien meegekopieerd.
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
