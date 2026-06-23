-- Migratie 18 — Brug ontkoppelen (remove_bridge).
--
-- tree_links heeft alleen een SELECT-policy; inserten gebeurt via de
-- security-definer-RPC accept_bridge_invite. Verwijderen kan daarom ook niet
-- client-side. Deze RPC laat een owner van één van beide gekoppelde bomen de
-- brug verbreken. De spiegel-persoon in de andere boom blijft gewoon bestaan;
-- alleen de koppeling verdwijnt.
--
-- Idempotent: create or replace.

create or replace function public.remove_bridge(p_person uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v tree_links;
begin
  select * into v from tree_links
   where person_a = p_person or person_b = p_person
   limit 1;
  if not found then return; end if;
  if not (public.is_owner_of_person(v.person_a) or public.is_owner_of_person(v.person_b)) then
    raise exception 'Geen rechten om deze koppeling te verbreken';
  end if;
  delete from tree_links
   where person_a = v.person_a and person_b = v.person_b;
end; $$;

grant execute on function public.remove_bridge(uuid) to authenticated;
