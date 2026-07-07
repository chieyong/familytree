-- Migratie 29 — "Bekijk als …" (owner-preview van een lagere rol/persoon).
--
-- Als PowerBI's "View as role": een owner ziet de boom zoals een lezer/
-- bijdrager/bewerker (en optioneel: vanuit een specifieke persoon) hem ziet.
-- Cruciaal is dat we de ÉCHTE RLS-logica opnieuw draaien met een gesimuleerde
-- identiteit — geen namaak in de frontend, want dat zou een tweede (afwijkende)
-- kopie van de zichtbaarheidsregels zijn.
--
-- Mechanisme: een transactie-lokale GUC `app.view_as` (JSON {family,role,self}).
-- De vier BASIS-helpers lezen die override; is er geen (normale situatie), dan
-- gedragen ze zich exact als voorheen. De AFGELEIDE helpers erven het gedrag
-- automatisch: is_owner_of_person → is_owner, can_manage_person → role_in_family.
--
-- Alleen te activeren via de nieuwe RPC's get_full_graph_as / get_ego_graph_as,
-- die (a) met de ECHTE identiteit controleren dat de aanroeper owner is —
-- bewust langs de override heen, zodat de override nooit tot rechten-escalatie
-- kan leiden — en (b) daarna de override transactie-lokaal zetten en het
-- ongewijzigde _build_graph aanroepen. PostgREST draait elke call in één
-- transactie, dus de override verdwijnt vanzelf en raakt geen schrijfpad.
-- View-as verlaagt altijd alleen rechten; het ergste dat een fout kan doen is
-- een onnauwkeurige preview, geen lek.
--
-- Idempotent: create or replace.

-- ─────────────────────────────────────────────────────────────────────────
-- Override uitlezen (NULL als niet gezet). Custom GUC's vereisen een prefix
-- met punt; nooit-gezet + missing_ok=true → NULL.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public._view_as()
returns jsonb language sql stable set search_path = public as $$
  select nullif(current_setting('app.view_as', true), '')::jsonb;
$$;
grant execute on function public._view_as() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Basis-helpers, nu override-bewust. Gedrag zonder override = ongewijzigd.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.is_member(p_family uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select case
    when (public._view_as()->>'family')::uuid = p_family then true
    else exists(select 1 from family_members
      where family_id = p_family and profile_id = auth.uid() and status = 'active')
  end;
$$;

create or replace function public.is_owner(p_family uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select case
    when (public._view_as()->>'family')::uuid = p_family
      then (public._view_as()->>'role') = 'owner'
    else exists(select 1 from family_members
      where family_id = p_family and profile_id = auth.uid() and status = 'active' and role = 'owner')
  end;
$$;

create or replace function public.role_in_family(p_family uuid)
returns member_role language sql security definer stable set search_path = public as $$
  select case
    when (public._view_as()->>'family')::uuid = p_family
      then (public._view_as()->>'role')::member_role
    else (select role from family_members
      where family_id = p_family and profile_id = auth.uid() and status = 'active')
  end;
$$;

-- is_self simuleert de gekozen persoon (globaal binnen de simulatie). Zonder
-- gekozen persoon (self = null) → voor niemand waar, dus alleen rol-simulatie.
create or replace function public.is_self(p_person uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select case
    when public._view_as() is not null
      then (public._view_as()->>'self')::uuid = p_person
    else exists(select 1 from family_members
      where self_person_id = p_person and profile_id = auth.uid() and status = 'active')
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Leespad-RPC's met simulatie. Poort (owner-check) draait op de ECHTE
-- identiteit, vóór het zetten van de override.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public._assert_real_owner(p_family uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from family_members
     where family_id = p_family and profile_id = auth.uid()
       and status = 'active' and role = 'owner') then
    raise exception 'Alleen de beheerder mag Bekijk-als gebruiken';
  end if;
end; $$;

create or replace function public.get_full_graph_as(
  p_family uuid, p_role text, p_person uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._assert_real_owner(p_family);
  if p_role not in ('viewer', 'contributor', 'editor') then
    raise exception 'Onbekende rol voor Bekijk-als: %', p_role;
  end if;
  if p_person is not null and not public.person_in_family(p_person, p_family) then
    raise exception 'Persoon hoort niet bij deze familie';
  end if;
  perform set_config('app.view_as',
    jsonb_build_object('family', p_family, 'role', p_role, 'self', p_person)::text, true);
  return public._build_graph(array(select id from persons where family_id = p_family));
end; $$;

create or replace function public.get_ego_graph_as(
  p_person uuid, p_depth int, p_role text, p_view_person uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_family uuid;
begin
  select family_id into v_family from persons where id = p_person;
  if v_family is null then
    return jsonb_build_object('persons', '[]'::jsonb, 'unions', '[]'::jsonb, 'parentLinks', '[]'::jsonb);
  end if;
  perform public._assert_real_owner(v_family);
  if p_role not in ('viewer', 'contributor', 'editor') then
    raise exception 'Onbekende rol voor Bekijk-als: %', p_role;
  end if;
  if p_view_person is not null and not public.person_in_family(p_view_person, v_family) then
    raise exception 'Persoon hoort niet bij deze familie';
  end if;
  perform set_config('app.view_as',
    jsonb_build_object('family', v_family, 'role', p_role, 'self', p_view_person)::text, true);
  return (
    with recursive
      edges as (
        select parent_id as a, child_id as b from parent_links where family_id = v_family
        union all select child_id, parent_id from parent_links where family_id = v_family
        union all select partner_a, partner_b from unions       where family_id = v_family
        union all select partner_b, partner_a from unions       where family_id = v_family
      ),
      bfs as (
        select p_person as id, 0 as d
        union all
        select e.b, b.d + 1
        from bfs b join edges e on e.a = b.id
        where b.d < least(p_depth, 4)
      )
    select public._build_graph(array(select distinct id from bfs))
  );
end; $$;

grant execute on function public.get_full_graph_as(uuid, text, uuid)      to authenticated;
grant execute on function public.get_ego_graph_as(uuid, int, text, uuid)  to authenticated;
