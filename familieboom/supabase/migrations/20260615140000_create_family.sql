-- Migratie 3 — create_family: familie + eigen persoon + zelf-koppeling in één keer.
-- De maker wordt owner (via trigger handle_new_family) en wordt aan zijn eigen
-- knooppunt gekoppeld (self_person_id) → "ik" = ingelogde gebruiker.

create or replace function public.create_family(
  p_name text,
  p_self_given_names text[],
  p_self_family_name text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_family uuid;
  v_person uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;

  insert into families (name) values (p_name) returning id into v_family;
  -- trigger handle_new_family maakt hier de owner-membership (active) aan

  insert into persons (family_id, given_names, family_name, visibility, managed_by, created_by)
    values (v_family, coalesce(p_self_given_names, '{}'), p_self_family_name, 'family', v_uid, v_uid)
    returning id into v_person;

  update family_members
    set self_person_id = v_person
    where family_id = v_family and profile_id = v_uid;

  return jsonb_build_object('familyId', v_family, 'personId', v_person);
end; $$;

grant execute on function public.create_family(text, text[], text) to authenticated;
