-- Migratie 24 — Voorstellen uitgebreid: nieuwe persoon + nieuwe relatie (fase 2b).
--
-- Naast 'person_update' kan een bijdrager nu ook voorstellen:
--   * 'person_add'   — nieuwe persoon als relatie van een ankerpersoon
--                      (payload: relation, given_names, family_name, call_name,
--                       name_native, nickname, sex, birth_year, death_year, visibility)
--   * 'relation_add' — bestaande persoon koppelen aan de anker (payload: relation, other_id)
-- target_person_id = de ankerpersoon in de boom. Bij goedkeuren past
-- resolve_proposal dezelfde inserts toe als add_relative/linkRelative.
--
-- Idempotent: constraint vervangen + create or replace function.

alter table change_proposals drop constraint if exists change_proposals_kind_check;
alter table change_proposals add constraint change_proposals_kind_check
  check (kind in ('person_update', 'person_add', 'relation_add'));

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
    if not exists (select 1 from persons where id = v_other and family_id = v.family_id) then
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
