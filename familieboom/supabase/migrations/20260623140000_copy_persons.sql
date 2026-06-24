-- Migratie 19 — Personen kopiëren tussen bomen (copy_persons).
--
-- Kopieert een selectie personen uit een bronfamilie naar een doelfamilie als
-- NIEUWE, onafhankelijke records (nieuwe id's). De onderlinge relaties worden
-- meegenomen: huwelijken (unions) en ouder-kindbanden (parent_links) waarvan
-- BEIDE personen in de selectie zitten. Relaties naar niet-geselecteerde
-- personen vallen weg. Foto's, bruggen en self-koppelingen gaan niet mee.
--
-- Rechten: caller moet owner zijn van zowel de bron- als de doelfamilie. Owner
-- van de bron mag alles van die boom zien (ook privé), dus geen lek via copy.
-- places is een globale tabel → plaats-verwijzingen kunnen gedeeld blijven.
--
-- Idempotent: create or replace.

create or replace function public.copy_persons(p_source uuid, p_target uuid, p_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
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

  -- Vooraf nieuwe id's bepalen, zodat we relaties kunnen omhangen.
  create temporary table _pmap (old_id uuid primary key, new_id uuid) on commit drop;
  insert into _pmap (old_id, new_id)
  select s.id, gen_random_uuid()
  from persons s
  where s.family_id = p_source and s.id = any(p_ids);

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
  from persons s join _pmap m on m.old_id = s.id;
  get diagnostics v_count = row_count;

  -- Huwelijken waarvan beide partners mee zijn (met nieuwe union-id's, zodat
  -- parent_links er straks naar kunnen blijven verwijzen).
  create temporary table _umap (old_id uuid primary key, new_id uuid) on commit drop;
  insert into _umap (old_id, new_id)
  select u.id, gen_random_uuid()
  from unions u
  where u.family_id = p_source
    and exists (select 1 from _pmap where old_id = u.partner_a)
    and exists (select 1 from _pmap where old_id = u.partner_b);

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

  -- Ouder-kindbanden waarvan beide kanten mee zijn (union_id omgehangen indien aanwezig).
  insert into parent_links (
    family_id, parent_id, child_id, role, union_id, start_year,
    existence_visibility, detail_visibility, surface_from_parent, surface_from_child
  )
  select p_target, mp.new_id, mc.new_id, pl.role, um.new_id, pl.start_year,
    pl.existence_visibility, pl.detail_visibility, pl.surface_from_parent, pl.surface_from_child
  from parent_links pl
  join _pmap mp on mp.old_id = pl.parent_id
  join _pmap mc on mc.old_id = pl.child_id
  left join _umap um on um.old_id = pl.union_id;

  return v_count;
end; $$;

grant execute on function public.copy_persons(uuid, uuid, uuid[]) to authenticated;
