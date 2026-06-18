-- Migratie 14 — bewerkers (role 'editor') konden geen personen/relaties
-- beheren. can_manage_person() erkende alleen de owner of de persoon-maker
-- (managed_by), niet de editor-rol. Daardoor faalde add_relative met
-- "Geen rechten op deze persoon" en konden editors niets bewerken aan
-- personen die de owner had aangemaakt. We laten de editor-rol meetellen.
--
-- Idempotent: create or replace; de bestaande policies/functies die deze
-- functie aanroepen pikken de nieuwe body automatisch op.

create or replace function public.can_manage_person(p_person uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from persons p
    where p.id = p_person
      and (p.managed_by = auth.uid()
           or public.role_in_family(p.family_id) in ('owner', 'editor')));
$$;
