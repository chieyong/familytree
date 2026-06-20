# Status & handoff

Korte overdracht zodat een nieuwe sessie (ook op mobiel/Termius) verder kan.
Laatst bijgewerkt: 2026-06-20.

Handige URL-params: `?backend=fixtures|supabase`, `?view=artwork|navigation`,
`?theme=light|dark`, `?lang=nl|en|zh|id`, `?focus=<id>`, `?tour=1` (opent de
rondleiding direct), `?data=habsburg`.

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
| 14 | `20260618160000_editor_can_manage.sql` | can_manage_person erkent editor-rol (fix "Toevoegen mislukt" voor bewerkers) | ⚠️ onbevestigd |

**Actie voor een verse sessie:** t/m 13 zijn gedraaid (12/13 geverifieerd via de
brug-test); 9, 11 en 14 zijn onbevestigd maar idempotent — bij twijfel gewoon
opnieuw draaien. De gebruiker draait ze zelf in de SQL-editor. Sinds migratie 14
zijn er **geen nieuwe migraties** bijgekomen; al het werk daarna is frontend.

## Features gebouwd na de PoC/backend (samenvatting van 6–13)
- **Namen in eigen schrift + bijnaam** (cultuur-neutraal; vervingen de eerdere
  gesplitste Chinese velden). Getoond op kaart + node (eigen schrift) en kaart
  (bijnaam).
- **Bulk-import** via platte CSV/TSV-template met preview; kan koppelen aan
  bestaande personen (resolver in de modal). Knop in familie-menu (owner).
- **Profielfoto's**: privé storage-bucket, foto's via signed URLs, weergave
  "focus + inzoomen" in de Tree met tak-kleur als ring, altijd in de kaart,
  toggle in het instellingen-menu (**standaard uit**, zie fixes 2026-06-20).
  Foto-editor met **camera-opname** + slepen/zoomen (crop).
- **"Dit ben ik"** (`self_person_id`) in het detailpaneel → zet je perspectief.
- **Rollen**: bij uitnodigen lezer/bewerker kiezen; rol achteraf wijzigen; lid
  verwijderen — alles onder Delen → Leden (owner).
- **Uitloggen** reset naar demo + bevestigingsbanner.
- **PWA** (installeerbaar): `vite-plugin-pwa` (`registerType: autoUpdate`),
  manifest + service worker, icons in `public/` (pwa-192/512, maskable, apple-
  touch), theme-color #141d33. SW geregistreerd in `main.tsx`. Google Fonts
  worden runtime-gecachet; Supabase-calls bewust niet (altijd vers). Dev maakt
  `dev-dist/` (gitignored).
- **Gekoppelde bomen (bruggen)** — zie `docs/linked-trees-design.md`. Fase 1
  (brug leggen via koppel-code, owner-only) + fase 2 (oversteken: ↗-markering
  op de node, "↗ ook in familie X" op de kaart, toegang vragen → pending-lid dat
  de andere owner goedkeurt, kruimelpad terug). Spiegel-model.
- **Editor-rechten** (migratie 14): bewerkers kunnen nu personen/relaties
  beheren (can_manage_person erkent de editor-rol).

## UI, talen & onboarding (mobiele sessie 2026-06-19 + 2026-06-20)
- **Meertalig (NL/EN/ZH/ID)**: `src/ui/i18n.ts` (NL is bron, type eruit
  afgeleid), `useT()`/`useGuide()`, taalkeuze als **vlag-knop** in het ⋯-menu.
  Bij nieuwe UI-tekst → sleutel in alle 4 talen toevoegen.
- **Topbar opgeruimd**: secundaire bediening (taal, thema, foto's, uitleg) onder
  één **instellingen-menu** (schuifregelaars-icoon, `OverflowMenu`); topbar houdt
  Tree|Tableau + account + delen. Volgorde toggle = **Tree | Tableau**.
- **Onboarding**: welkomstkaart (eerste login) + **uitleg-gids** (`HelpGuide`,
  accordeon, `guideContent.ts`) — privacy zit hierin. **Coachmark-rondleiding**
  (`Tour.tsx`): spotlight op echte elementen, start via "✨ Rondleiding" in de
  gids of `?tour=1`.
- **Opstart-leader** (`Leader.tsx`): logo bloeit open + "Bloom", 1×/sessie,
  overslaanbaar, uit bij reduced-motion; verdwijnt als de graaf geladen is.
- **Genodigde** landt direct in z'n boom: auto-open van (laatste/eerste) familie
  na login + "Open je familieboom: X"-banner als vangnet.
- **Login**: Google-knop prominent (wit + logo), e-mail secundair. Ingelogd →
  knop toont "Ingelogd"; klik opent popover met e-mail + uitloggen.
- **Uitnodigingslink**: expliciete Kopieer-knop + native delen (`navigator.share`).
- **Persoonskaart**: alleen zichtbaar bij een **geselecteerde** node; klik op leeg
  vlak deselecteert. Klik op de kaart opent het **detailpaneel**, dat eerst
  **alleen-lezen** is (gegevens + relaties opengeklapt) en pas op "bewerken"
  bewerkbaar wordt. Geen potlood meer.
- **Interactie**: pop-ups (familie-menu, delen, account, legenda) sluiten bij klik
  buiten; **dubbelklik/-tik togglet zoom** (in → overzicht).

## Fixes & polish (sessie 2026-06-20, deel 2)
- **Generatie-layout**: `KinshipService.generations()` verankerde elke wortel
  (zonder ouders) op 0 → de enige ouder van een partner kwam op grootouder-hoogte.
  Nu zakt elke ouder naar één generatie boven z'n laagste kind, dus (schoon)ouders
  lijnen uit. Regressietest in `src/domain/kinship.test.ts` (was er nog niet).
- **Foto's standaard UIT**: `photos`-default omgezet (`=== 'on'` i.p.v. `!== 'off'`)
  in `store.ts`. Aan te zetten via instellingen-menu. **Let op**: alleen nieuwe
  gebruikers krijgen de nieuwe default; wie de toggle eerder op `'on'` zette houdt
  foto's. De foto in de **persoonskaart** blijft altijd zichtbaar bij selectie
  (`photoByPerson` gaat los van de flag naar `PersonPanel`).
- **Legenda sluit bij klik buiten**: `backdrop-filter` op `.legend` maakte het blok
  tot containing block voor de `fixed` backdrop (dekte alleen het doosje). Backdrop
  naar root-niveau, `z-index: 10` (onder legenda 11, boven doek).
- **Relaties open bij "bewerken"**: `RelationsEditor` zette `open` alleen bij mount
  via `useState(embedded)`; React hergebruikt de instantie bij lezen→bewerken, dus
  het paneel bleef dicht. Nu `isOpen = embedded || open`.
- **Huwelijksjaar** in te voeren: nieuw startjaar-veld in `UnionRow` +
  `setUnionStart`-mutatie (DB-kolommen `start_year/month/day` + read-RPC bestonden
  al, **geen migratie**). Ook getoond in de alleen-lezen kaart; i18n-sleutel
  `sinceYear` in NL/EN/ZH/ID. Tableau-view gebruikte `union.start.year` al voor de
  huwelijkslijn.

## Verifiëren
- Niet-ingelogde / demo-flows: headless Chrome screenshot, bv.
  `--headless=new --screenshot=out.png "http://localhost:5199/?backend=fixtures&view=navigation&focus=lisa"`.
- **Headless-valkuilen**: (1) de opstart-**leader** blijft onder headless hangen
  (virtual-time stalt door continue animatie-frames) en kan de demo blokkeren;
  (2) **CSS-animaties** lopen niet onder `--virtual-time-budget` (alleen
  JS/framer-motion), dus CSS-fades tonen niet op de screenshot. Isoleer zulke
  stukken in een los HTML-bestand om ze te verifiëren.
- **Ingelogde flows (eigen familie, delen, bruggen, foto-upload) en interactie
  (klikken/slepen/oversteken) kunnen NIET headless** — die test de gebruiker zelf
  op bloom.vizcraft.nl.

## Volgende stappen
- ✅ Bruggen Lai ↔ Man via Weiyie getest met twee owners — werkte (2026-06-18).
- Bruggen v2 (later, zie design-doc): begrensd alleen-lezen oversteken, één
  doorlopend gestikt beeld, brug intrekken in de UI, profielsync tussen de
  spiegel-knopen.

## Conventies
- Commits eindigen met `Co-Authored-By: Claude <noreply@anthropic.com>` (neutraal; voorheen "Claude Fable 5").
- `service_role`-key nooit committen/tonen; anon/publishable key is public-safe
  (staat in gitignored `.env.local` + de hosting-env).
