-- Migratie 21 — Beheerrecht volgt je HUIDIGE rol, niet je verleden.
--
-- can_manage_person() stond beheer toe zodra managed_by = auth.uid(): wie een
-- persoon ooit aanmaakte (als editor/owner) bleef die bewerken, ook na degradatie
-- naar viewer. Dat is een lek — een lezer kon zo personen blijven bewerken.
-- Voortaan bepaalt alleen de actieve rol (owner/editor) het beheerrecht.
--
-- Geldt meteen voor alle schrijfpolicies (persons/unions/parent_links) die deze
-- functie gebruiken. Idempotent: create or replace.

create or replace function public.can_manage_person(p_person uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from persons p
    where p.id = p_person
      and public.role_in_family(p.family_id) in ('owner', 'editor'));
$$;
