-- Migratie 11 — claim_self_person: koppel je account aan een persoon-knooppunt
-- ("dit ben ik"). Nodig omdat self_person_id alleen bij het aanmaken van een
-- familie automatisch gezet wordt; daarna kon je 'm niet meer (her)zetten. Via
-- RPC zodat ook een gewoon lid zijn eigen koppeling mag leggen (members_update
-- is owner-only). SECURITY DEFINER, met checks op lidmaatschap en familie.

create or replace function public.claim_self_person(p_family uuid, p_person uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if not exists (select 1 from family_members
                 where family_id = p_family and profile_id = v_uid and status = 'active') then
    raise exception 'Geen actief lid van deze familie';
  end if;
  if not exists (select 1 from persons where id = p_person and family_id = p_family) then
    raise exception 'Persoon hoort niet bij deze familie';
  end if;
  update family_members
    set self_person_id = p_person
    where family_id = p_family and profile_id = v_uid;
end; $$;

grant execute on function public.claim_self_person(uuid, uuid) to authenticated;
