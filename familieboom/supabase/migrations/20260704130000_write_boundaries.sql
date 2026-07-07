-- Migratie 27 — Schrijfgrenzen per familie (security-review 2026-07-04, punt 4).
--
-- family_id-consistentie werd nergens afgedwongen (bewust geen CHECK i.v.m. de
-- latere cross-tree-fase), maar daardoor kon iedereen met beheerrecht in de
-- éígen boom personen/relaties in een ándere boom injecteren:
--   * add_relative checkte alleen can_manage_person(anker), niet of het anker
--     bij p_family hoort → nieuwe persoon + link kregen een willekeurig,
--     door de aanroeper gekozen family_id (losse knopen in andermans boom).
--   * unions/parent_links: de with check keek alleen naar beheerrecht op een
--     eindpunt, niet of family_id klopt met de families van de eindpunten.
--   * resolve_proposal: bij person_add/relation_add werd nooit gecheckt dat de
--     ankerpersoon (target_person_id) bij de familie van het voorstel hoort.
--
-- De grens zit nu in de RPC's en de with check-policies (géén harde CHECK op de
-- tabellen, zodat de cross-tree-fase die later gecontroleerd kan openen).
-- Gebruikt public.person_in_family() uit migratie 26.
--
-- Idempotent: create or replace / drop policy if exists.

-- ─────────────────────────────────────────────────────────────────────────
-- add_relative: anker moet bij p_family horen (beheerrecht impliceert dan
-- automatisch de juiste rol in díé familie).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.add_relative(
  p_family uuid,
  p_relation text,        -- 'parent' | 'child' | 'partner'
  p_anchor uuid,          -- bestaande persoon
  p_given text[],
  p_family_name text default null,
  p_sex text default null,
  p_birth_year int default null,
  p_name_native text default null,
  p_nickname text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_new uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if not public.person_in_family(p_anchor, p_family) then
    raise exception 'Persoon hoort niet bij deze familie';
  end if;
  if not public.can_manage_person(p_anchor) then
    raise exception 'Geen rechten op deze persoon';
  end if;

  insert into persons (family_id, given_names, family_name, name_native, nickname,
                       sex, birth_year, visibility, managed_by, created_by)
    values (p_family, coalesce(p_given, '{}'), p_family_name, p_name_native, p_nickname,
            p_sex::sex, p_birth_year, 'family', v_uid, v_uid)
    returning id into v_new;

  if p_relation = 'parent' then
    insert into parent_links (family_id, parent_id, child_id, existence_visibility, detail_visibility)
      values (p_family, v_new, p_anchor, 'family', 'family');
  elsif p_relation = 'child' then
    insert into parent_links (family_id, parent_id, child_id, existence_visibility, detail_visibility)
      values (p_family, p_anchor, v_new, 'family', 'family');
  elsif p_relation = 'partner' then
    insert into unions (family_id, partner_a, partner_b, type, existence_visibility, detail_visibility)
      values (p_family, p_anchor, v_new, 'marriage', 'family', 'family');
  else
    raise exception 'Onbekende relatie: %', p_relation;
  end if;

  return jsonb_build_object('personId', v_new);
end; $$;

grant execute on function public.add_relative(uuid, text, uuid, text[], text, text, int, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- unions/parent_links: nieuwe rijen (en gewijzigde) moeten een family_id
-- hebben dat klopt met de familie van beide eindpunten.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists unions_write on unions;
create policy unions_write on unions for all
  using (public.can_manage_person(partner_a) or public.can_manage_person(partner_b))
  with check (
    (public.can_manage_person(partner_a) or public.can_manage_person(partner_b))
    and public.person_in_family(partner_a, family_id)
    and public.person_in_family(partner_b, family_id)
  );

drop policy if exists plinks_write on parent_links;
create policy plinks_write on parent_links for all
  using (public.can_manage_person(parent_id) or public.can_manage_person(child_id))
  with check (
    (public.can_manage_person(parent_id) or public.can_manage_person(child_id))
    and public.person_in_family(parent_id, family_id)
    and public.person_in_family(child_id, family_id)
  );

-- ─────────────────────────────────────────────────────────────────────────
-- resolve_proposal: ankerpersoon moet bij de familie van het voorstel horen.
-- Verder identiek aan migratie 24.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.resolve_proposal(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v change_proposals;
  v_new uuid;
  v_rel text;
  v_other uuid;
begin
  select * into v from change_proposals where id = p_id;
  if not found then raise exception 'Voorstel niet gevonden'; end if;
  if v.status <> 'pending' then raise exception 'Voorstel is al afgehandeld'; end if;
  if public.role_in_family(v.family_id) not in ('owner', 'editor') then
    raise exception 'Geen rechten om voorstellen af te handelen';
  end if;
  if v.target_person_id is not null
     and not public.person_in_family(v.target_person_id, v.family_id) then
    raise exception 'Ankerpersoon hoort niet bij deze familie';
  end if;

  if p_approve and v.kind = 'person_update' and v.target_person_id is not null then
    update persons p set
      given_names = coalesce(
        (select array_agg(x) from jsonb_array_elements_text(v.payload->'given_names') x),
        p.given_names),
      family_name    = v.payload->>'family_name',
      call_name      = v.payload->>'call_name',
      name_native    = v.payload->>'name_native',
      nickname       = v.payload->>'nickname',
      preferred_name = v.payload->>'preferred_name',
      sex            = (v.payload->>'sex')::sex,
      birth_year     = (v.payload->>'birth_year')::int,
      death_year     = (v.payload->>'death_year')::int,
      visibility     = coalesce((v.payload->>'visibility')::visibility, p.visibility)
    where p.id = v.target_person_id and p.family_id = v.family_id;

  elsif p_approve and v.kind = 'person_add' and v.target_person_id is not null then
    v_rel := v.payload->>'relation';
    insert into persons (family_id, given_names, family_name, call_name, name_native, nickname,
                         sex, birth_year, death_year, visibility, managed_by, created_by)
    values (v.family_id,
            coalesce((select array_agg(x) from jsonb_array_elements_text(v.payload->'given_names') x), '{}'),
            v.payload->>'family_name', v.payload->>'call_name', v.payload->>'name_native', v.payload->>'nickname',
            (v.payload->>'sex')::sex, (v.payload->>'birth_year')::int, (v.payload->>'death_year')::int,
            coalesce((v.payload->>'visibility')::visibility, 'family'), auth.uid(), auth.uid())
    returning id into v_new;

    if v_rel = 'parent' then
      insert into parent_links (family_id, parent_id, child_id, existence_visibility, detail_visibility)
        values (v.family_id, v_new, v.target_person_id, 'family', 'family');
    elsif v_rel = 'child' then
      insert into parent_links (family_id, parent_id, child_id, existence_visibility, detail_visibility)
        values (v.family_id, v.target_person_id, v_new, 'family', 'family');
    elsif v_rel = 'partner' then
      insert into unions (family_id, partner_a, partner_b, type, existence_visibility, detail_visibility)
        values (v.family_id, v.target_person_id, v_new, 'marriage', 'family', 'family');
    end if;

  elsif p_approve and v.kind = 'relation_add' and v.target_person_id is not null then
    v_rel := v.payload->>'relation';
    v_other := (v.payload->>'other_id')::uuid;
    if not public.person_in_family(v_other, v.family_id) then
      raise exception 'Gekoppelde persoon hoort niet bij deze familie';
    end if;
    if v_rel = 'partner' then
      insert into unions (family_id, partner_a, partner_b, type, existence_visibility, detail_visibility)
        values (v.family_id, v.target_person_id, v_other, 'marriage', 'family', 'family');
    elsif v_rel = 'parent' then
      insert into parent_links (family_id, parent_id, child_id, existence_visibility, detail_visibility)
        values (v.family_id, v_other, v.target_person_id, 'family', 'family');
    elsif v_rel = 'child' then
      insert into parent_links (family_id, parent_id, child_id, existence_visibility, detail_visibility)
        values (v.family_id, v.target_person_id, v_other, 'family', 'family');
    end if;
  end if;

  update change_proposals
    set status = case when p_approve then 'approved' else 'rejected' end,
        resolved_by = auth.uid(),
        resolved_at = now()
  where id = p_id;
end; $$;

grant execute on function public.resolve_proposal(uuid, boolean) to authenticated;
