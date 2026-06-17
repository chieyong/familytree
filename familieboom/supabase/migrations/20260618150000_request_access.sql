-- Migratie 13 — gekoppelde bomen (fase 2: oversteken). request_family_access
-- laat je toegang vragen tot een familie waar je via een brug aan vastzit. Zet
-- een *pending* lidmaatschap; de owner van die familie keurt goed via het
-- bestaande Delen → Leden (de poortwachter). Geen brug = geen verzoek mogelijk,
-- zodat je niet zomaar bij willekeurige bomen kunt aankloppen.

create or replace function public.request_family_access(p_family uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_status member_status;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  -- Er moet een actieve brug zijn tussen p_family en een familie waar je lid van bent.
  if not exists (
    select 1 from tree_links t
    where (t.family_a = p_family and public.is_member(t.family_b))
       or (t.family_b = p_family and public.is_member(t.family_a))
  ) then
    raise exception 'Geen brug naar deze familie';
  end if;

  select status into v_status from family_members
    where family_id = p_family and profile_id = v_uid;
  if v_status is null then
    insert into family_members (family_id, profile_id, role, status)
      values (p_family, v_uid, 'viewer', 'pending');
    return 'pending';
  end if;
  return v_status::text;
end; $$;

grant execute on function public.request_family_access(uuid) to authenticated;
