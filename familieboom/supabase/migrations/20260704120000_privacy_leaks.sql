-- Migratie 26 — Datalekken dicht (security-review 2026-07-04, punten 1–3).
--
-- 1. places: was wereld-leesbaar (anon-grant + using(true)) en door élke
--    ingelogde gebruiker te bewerken. Plaatsnamen + lat/lon kunnen woonplaatsen
--    van levenden zijn → lezen voortaan alleen ingelogd; update-policy vervalt
--    (de app maakt plaatsen alleen aan, upsertPlace dedupt op naam+coördinaat).
-- 2. avatars: het leespad checkte alleen familie-lidmaatschap, terwijl het pad
--    (<family_id>/<person_id>) voorspelbaar is en de stub het person-id lekt —
--    elk lid kon dus de foto van een privé-persoon ophalen. Lezen volgt nu de
--    persoons-zichtbaarheid (RLS op persons doet het werk). Schrijven eist dat
--    de map overeenkomt met de familie van de persoon. Plus bucket-limieten.
-- 3. invites: tokens verliepen nooit, waren onbeperkt herbruikbaar en leesbaar
--    voor élk lid (ook editor-tokens). Voortaan: 14 dagen default-expiry,
--    alleen owner/maker leest tokens, en de rol op een invite is begrensd
--    (editor mag alleen lezer/bijdrager uitnodigen — de UI deed dit al, de
--    database dwingt het nu af).
-- 4. profielen: display_name viel terug op het volledige e-mailadres en
--    list_members toont dat aan alle leden → voortaan alleen het deel vóór de @.
--
-- Idempotent: drop policy if exists / create or replace / update-backfills met
-- where-clausule.

-- ─────────────────────────────────────────────────────────────────────────
-- Helper: hoort persoon bij familie? SECURITY DEFINER zodat policies dit ook
-- kunnen checken voor personen die de schrijver zelf niet mag lezen (privé).
-- Ook gebruikt door migratie 27 (schrijfgrenzen).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.person_in_family(p_person uuid, p_family uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from persons where id = p_person and family_id = p_family);
$$;
grant execute on function public.person_in_family(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. places
-- ─────────────────────────────────────────────────────────────────────────
revoke select on places from anon;

drop policy if exists places_select on places;
create policy places_select on places for select
  using (auth.uid() is not null);

-- Plaatsen zijn onveranderlijk na aanmaken (correctie = nieuwe plaats + herkoppelen).
drop policy if exists places_update on places;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. avatars-bucket
-- ─────────────────────────────────────────────────────────────────────────
-- Lezen: alleen wie de persoon zelf mag zien. De subquery loopt onder de
-- rechten van de aanvrager, dus persons-RLS (stub/privé/fully_hidden) bepaalt
-- het antwoord — de foto volgt nu écht de zichtbaarheid van de persoon.
drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars'
         and exists (select 1 from persons p where p.id = (storage.filename(name))::uuid));

-- Schrijven: beheerrecht op de persoon ÉN de map moet de familie van die
-- persoon zijn (voorheen kon een editor bestanden in andermans familie-map
-- plaatsen).
drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects for insert
  with check (bucket_id = 'avatars'
              and public.can_manage_person((storage.filename(name))::uuid)
              and public.person_in_family((storage.filename(name))::uuid,
                                          ((storage.foldername(name))[1])::uuid));
drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update
  using (bucket_id = 'avatars'
         and public.can_manage_person((storage.filename(name))::uuid)
         and public.person_in_family((storage.filename(name))::uuid,
                                     ((storage.foldername(name))[1])::uuid));
drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete
  using (bucket_id = 'avatars'
         and public.can_manage_person((storage.filename(name))::uuid)
         and public.person_in_family((storage.filename(name))::uuid,
                                     ((storage.foldername(name))[1])::uuid));

-- Limieten: PhotoEditor levert 512px JPEG → 2 MB en alleen afbeeldingen.
update storage.buckets
  set file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id = 'avatars';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. family_invites
-- ─────────────────────────────────────────────────────────────────────────
alter table family_invites
  alter column expires_at set default (now() + interval '14 days');

-- Bestaande eeuwige links krijgen alsnog een houdbaarheid.
update family_invites
  set expires_at = now() + interval '14 days'
  where expires_at is null;

-- Rol op de invite begrensd: owner mag elke rol uitdelen, editor alleen
-- lezer/bijdrager. (Voorheen kon een editor een owner-invite minten.)
drop policy if exists invites_insert on family_invites;
create policy invites_insert on family_invites for insert
  with check (
    created_by = auth.uid()
    and (public.is_owner(family_id)
         or (public.role_in_family(family_id) = 'editor'
             and role in ('viewer', 'contributor')))
  );

-- Tokens zijn geheimen: alleen de owner en de maker van de link lezen ze
-- (voorheen kon élk lid, ook een viewer, alle openstaande tokens uitlezen).
drop policy if exists invites_select on family_invites;
create policy invites_select on family_invites for select
  using (public.is_owner(family_id) or created_by = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 4. profielen: geen e-mailadres als terugval-weergavenaam
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',
                           split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end; $$;

update profiles
  set display_name = split_part(display_name, '@', 1)
  where display_name like '%@%';
