# Status & handoff

Korte overdracht zodat een nieuwe sessie (ook op mobiel/Termius) verder kan.
Laatst bijgewerkt: 2026-06-18.

## Wat dit is
Interactieve familieboom-webapp "Bloom". Stack: Vite + React 18 + TypeScript
(strict, `erasableSyntaxOnly`), Zustand, D3 als rekenlaag, Framer Motion.
Backend: Supabase (Postgres + RLS deny-by-default + Auth). App-code in
`familieboom/`. Live op **https://bloom.vizcraft.nl** (env:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BACKEND=supabase`).

Bouwen/typecheck: `npm run build`. Tests: `npm test` (vitest).
Lokaal draaien tegen de DB: `npm run dev` + `?backend=supabase`. Demo zonder
DB: `?backend=fixtures`.

## Migraties — belangrijk
Migraties staan in `supabase/migrations/` en worden **handmatig in de Supabase
SQL-editor gedraaid** (de GitHub↔Supabase-koppeling staat UIT). Ze zijn allemaal
**idempotent** geschreven (`create table if not exists`, `create or replace`,
`add column if not exists`, `drop policy if exists`) → bij twijfel gewoon
opnieuw draaien, dat kan geen kwaad.

| # | bestand | inhoud | gedraaid? |
|---|---------|--------|-----------|
| 1 | `20260615120000_init.sql` | tabellen, enums, RLS | ✅ |
| 2 | `20260615130000_read_rpc.sql` | get_ego_graph / get_full_graph | ✅ |
| 3 | `20260615140000_create_family.sql` | create_family | ✅ |
| 4 | `20260615150000_add_relative.sql` | add_relative | ✅ |
| 5 | `20260615160000_invites.sql` | accept_invite, list_members | ✅ |
| 6 | `20260616120000_extra_names.sql` | name_native + nickname kolommen, _build_graph | ✅ |
| — | (opruim-SQL) | drop kolommen family_name_zh/given_name_zh | ✅ |
| 7 | `20260617120000_add_relative_names.sql` | add_relative + naamvelden | ✅ |
| 8 | `20260617130000_import_family.sql` | bulk-import RPC | ✅ |
| 9 | `20260617140000_import_existing.sql` | import koppelt aan bestaande personen | ⚠️ onbevestigd |
| 10 | `20260618120000_photos.sql` | photo_path, privé-bucket avatars + storage-RLS, _build_graph | ✅ |
| 11 | `20260618130000_claim_self.sql` | claim_self_person ("dit ben ik") | ⚠️ onbevestigd |
| 12 | `20260618140000_tree_links.sql` | tree_links + bridge_invites + RPC's, _build_graph (bridge) | ✅ (brug werkte) |
| 13 | `20260618150000_request_access.sql` | request_family_access | ✅ (brug + oversteken geverifieerd 2026-06-18) |

**Actie voor een verse sessie:** alle migraties t/m 13 zijn gedraaid; 9 en 11
blijven onbevestigd maar idempotent (bij twijfel opnieuw draaien). De gebruiker
draait ze zelf in de SQL-editor.

## Features gebouwd na de PoC/backend (samenvatting van 6–13)
- **Namen in eigen schrift + bijnaam** (cultuur-neutraal; vervingen de eerdere
  gesplitste Chinese velden). Getoond op kaart + node (eigen schrift) en kaart
  (bijnaam).
- **Bulk-import** via platte CSV/TSV-template met preview; kan koppelen aan
  bestaande personen (resolver in de modal). Knop in familie-menu (owner).
- **Profielfoto's**: privé storage-bucket, foto's via signed URLs, weergave
  "focus + inzoomen" in de Tree met tak-kleur als ring, altijd in de kaart,
  topbar-toggle. Foto-editor met **camera-opname** + slepen/zoomen (crop).
- **"Dit ben ik"** (`self_person_id`) in het detailpaneel → zet je perspectief.
- **Rollen**: bij uitnodigen lezer/bewerker kiezen; rol achteraf wijzigen; lid
  verwijderen — alles onder Delen → Leden (owner).
- **Uitloggen** reset naar demo + bevestigingsbanner.
- **Gekoppelde bomen (bruggen)** — zie `docs/linked-trees-design.md`. Fase 1
  (brug leggen via koppel-code, owner-only) + fase 2 (oversteken: ↗-markering
  op de node, "↗ ook in familie X" op de kaart, toegang vragen → pending-lid dat
  de andere owner goedkeurt, kruimelpad terug). Spiegel-model.

## Verifiëren
- Niet-ingelogde / demo-flows: headless Chrome screenshot, bv.
  `--headless=new --screenshot=out.png "http://localhost:5199/?backend=fixtures&view=navigation&focus=lisa"`.
- **Ingelogde flows (eigen familie, delen, bruggen, foto-upload) kunnen NIET
  headless** — die test de gebruiker zelf op bloom.vizcraft.nl.

## Volgende stappen
- ✅ Bruggen Lai ↔ Man via Weiyie getest met twee owners — werkte (2026-06-18).
- Bruggen v2 (later, zie design-doc): begrensd alleen-lezen oversteken, één
  doorlopend gestikt beeld, brug intrekken in de UI, profielsync tussen de
  spiegel-knopen.

## Conventies
- Commits eindigen met `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- `service_role`-key nooit committen/tonen; anon/publishable key is public-safe
  (staat in gitignored `.env.local` + de hosting-env).
