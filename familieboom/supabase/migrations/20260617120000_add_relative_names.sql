-- Migratie 7 — add_relative uitgebreid met de cultuur-neutrale naamvelden
-- (naam in eigen schrift + bijnaam), zodat ze al bij het aanmaken meekunnen.
-- Oude signatuur eerst droppen: nieuwe parameters = andere overload, en
-- PostgREST moet niet tussen twee versies hoeven kiezen.

drop function if exists public.add_relative(uuid, text, uuid, text[], text, text, int);

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
