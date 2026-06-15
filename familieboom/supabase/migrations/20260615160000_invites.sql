-- Migratie 5 — uitnodigingen: accepteren (→ pending lid) + ledenlijst.

-- Iemand opent een uitnodigingslink en wordt pending lid. SECURITY DEFINER,
-- want de gebruiker is nog geen lid en kan de invite/membership-tabellen niet
-- direct lezen/schrijven.
create or replace function public.accept_invite(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_inv      family_invites;
  v_famname  text;
  v_status   member_status;
begin
  if v_uid is null then raise exception 'Niet ingelogd'; end if;

  select * into v_inv from family_invites where token = p_token;
  if v_inv.id is null then raise exception 'Ongeldige uitnodiging'; end if;
  if v_inv.revoked then raise exception 'Uitnodiging ingetrokken'; end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    raise exception 'Uitnodiging verlopen';
  end if;

  select status into v_status from family_members
    where family_id = v_inv.family_id and profile_id = v_uid;
  if v_status is null then
    insert into family_members (family_id, profile_id, role, status)
      values (v_inv.family_id, v_uid, v_inv.role, 'pending');
    v_status := 'pending';
  end if;

  select name into v_famname from families where id = v_inv.family_id;
  return jsonb_build_object('familyId', v_inv.family_id, 'familyName', v_famname, 'status', v_status);
end; $$;

grant execute on function public.accept_invite(uuid) to authenticated;

-- Leden van een familie met hun naam/status — ook pending-leden, die de owner
-- via gewone RLS niet zou kunnen lezen (shares_family_with telt alleen actieve).
create or replace function public.list_members(p_family uuid)
returns jsonb language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'profileId', m.profile_id,
    'name', coalesce(pr.display_name, 'onbekend'),
    'role', m.role,
    'status', m.status
  ) order by m.status, pr.display_name), '[]'::jsonb)
  from family_members m
  join profiles pr on pr.id = m.profile_id
  where m.family_id = p_family and public.is_member(p_family);
$$;

grant execute on function public.list_members(uuid) to authenticated;
