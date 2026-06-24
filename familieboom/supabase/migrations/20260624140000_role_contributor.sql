-- Migratie 22 — Nieuwe rol 'contributor' (Bijdrager).
--
-- Een bijdrager mag niet direct schrijven (telt niet als owner/editor in
-- can_manage_person), maar mag wél wijzigingen VOORSTELLEN. De voorstellen-tabel
-- en -RPC staan in migratie 23. Deze enum-waarde moet eerst committen voordat
-- migratie 23 'm in policies kan gebruiken — daarom een aparte migratie.
--
-- Idempotent: add value if not exists.

alter type member_role add value if not exists 'contributor';
