# Status & handoff

Korte overdracht zodat een nieuwe sessie (ook op mobiel/Termius) verder kan.
Laatst bijgewerkt: 2026-07-10.

Handige URL-params: `?backend=fixtures|supabase`, `?view=artwork|navigation|globe`,
`?theme=light|dark`, `?lang=nl|en|zh|id`, `?focus=<id>`, `?tour=1` (opent de
rondleiding direct), `?data=demo|diaspora|habsburg`, `?layer=migration|life`
(Atlas-verhaallaag).

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
| 15 | `20260620120000_preferred_name.sql` | preferred_name kolom (welke naam als hoofd-label in de boom), _build_graph | ✅ (2026-06-20) |
| 16 | `20260620130000_owner_only_private.sql` | privé-personen alleen voor owner: persons_select + _build_graph gebruiken is_owner_of_person i.p.v. can_manage_person | ✅ (2026-06-20) |
| 17 | `20260623120000_call_name.sql` | roepnaam: kolom `call_name` + `_build_graph` geeft `callName` mee | ✅ (2026-06-23) |
| 18 | `20260623130000_remove_bridge.sql` | `remove_bridge(p_person)` RPC: owner verbreekt een brug (tree_links delete) | ✅ (2026-06-23) |
| 19 | `20260623140000_copy_persons.sql` | `copy_persons(bron, doel, ids[])` RPC: kopieert personen + onderlinge unions/parent_links naar een andere boom (owner van bron én doel) | ✅ (2026-06-23) |
| 20 | `20260624120000_copy_persons_anchors.sql` | `copy_persons(...,p_anchors)`: anchors-map (bron→bestaand doel) om kopieën aan bestaande personen te knopen; dedup van bestaande relaties. Dropt oude 3-arg signatuur | ✅ (2026-06-24) |
| 21 | `20260624130000_manage_by_role_only.sql` | `can_manage_person` zonder `managed_by`-tak: beheerrecht volgt alleen de actieve rol (owner/editor) — dicht lek waarbij gedegradeerde viewer eigen aangemaakte personen bleef bewerken | ✅ (2026-06-24) |
| 22 | `20260624140000_role_contributor.sql` | enum `member_role` krijgt `contributor` (Bijdrager). **Apart** want enum-waarde moet committen vóór migratie 23 'm gebruikt | ✅ (2026-06-24) |
| 23 | `20260624150000_change_proposals.sql` | `change_proposals`-tabel + RLS + RPC `resolve_proposal` (owner/editor keurt voorstel goed/af, past person_update toe) | ✅ (2026-06-24) |
| 24 | `20260624160000_proposals_add.sql` | `resolve_proposal` + kinds `person_add` & `relation_add` (bijdrager stelt nieuwe persoon/koppeling voor; goedkeuren past add_relative/linkRelative-logica toe) | ✅ (2026-06-24) |
| 25 | `20260626120000_residences_read.sql` | `_build_graph` geeft nu **`residences`** terug (place + from/to + id, geordend op from_year) i.p.v. `'[]'` → woonplaatsen/levenspaden op de Atlas voor échte families | ✅ (2026-07-04) |
| 26 | `20260704120000_privacy_leaks.sql` | security-review: `places` niet meer wereld-leesbaar/muteerbaar (anon-grant ingetrokken, update-policy weg), avatar-lezen volgt persoons-zichtbaarheid (was: elk lid, pad voorspelbaar), avatar-schrijven eist map=familie, bucket-limieten (2 MB, alleen afbeeldingen), invites: 14 dagen default-expiry + backfill, tokens alleen leesbaar voor owner/maker, editor mag alleen lezer/bijdrager-invites, display_name-terugval zonder e-maildomein + backfill. Introduceert helper `person_in_family()` | ✅ (2026-07-04) |
| 27 | `20260704130000_write_boundaries.sql` | security-review: family_id-grens afgedwongen — `add_relative` checkt anker∈familie, `unions_write`/`plinks_write` with check eist eindpunten∈family_id, `resolve_proposal` checkt anker én gekoppelde persoon∈familie. Vereist mig 26 (`person_in_family`) | ✅ (2026-07-04) |
| 28 | `20260704140000_privacy_consistency.sql` | security-review: privé-relaties alleen owner/betrokkene (unions/plinks-leespaden van can_manage_person → is_owner/is_self; partner ziet eigen relatie nu ook als viewer), `detail_visibility` op parent_links wordt eindelijk gemaskeerd (role→'biological' + `detailHidden`), `fully_hidden` geldt nu ook voor de owner + trigger `persons_guard` (vlag alleen door persoon zelf; family_id/created_by onveranderlijk), `copy_persons` slaat fully_hidden over, rer_update alleen aanvrager/owner. Bevat de volledige `_build_graph` incl. residences (superset van mig 25) | ✅ (2026-07-04) |
| 29 | `20260704150000_view_as.sql` | **"Bekijk als …"** (owner-preview): basis-helpers `is_member`/`is_owner`/`role_in_family`/`is_self` worden override-bewust via transactie-lokale GUC `app.view_as` (afgeleiden `is_owner_of_person`/`can_manage_person` erven het). RPC's `get_full_graph_as`/`get_ego_graph_as` gaten op ECHTE owner (`_assert_real_owner`, langs override heen), zetten override, roepen ongewijzigd `_build_graph`. Zonder override = identiek gedrag. Verlaagt alleen rechten → geen escalatie mogelijk | ✅ (2026-07-04) |
| 30 | `20260710120000_multiple_nicknames.sql` | **meerdere bijnamen**: kolom `nicknames text[]` + backfill uit scalar `nickname`; `_build_graph` geeft nu de array `nicknames` terug (met terugval op de scalar). Additief — scalar `nickname` blijft en wordt door de frontend gesynchroniseerd op `nicknames[0]` (achterwaartse compat) | ✅ (2026-07-10) |
| 31 | `20260710140000_import_rich.sql` | **import verrijkt + round-trip**: helper `_import_place` (server-side plaats-upsert); `import_family` schrijft nu ook roepnaam, `nicknames[]`, zichtbaarheid, geboorte-/sterfteplaats + woonplaatsen. Rij met `db_id` → bestaande **bijwerken**, zonder → nieuwe aanmaken; ouder-kind/unions worden ontdubbeld (re-import voegt alleen nieuw toe) | ✅ (2026-07-10) |

**Actie voor een verse sessie:** migraties t/m 31 zijn gedraaid (30–31 op 2026-07-10).
Niets meer open.

**Gekoppelde bomen — samengevoegde weergave (2026-07-10)** — meerdere gekoppelde
familiebomen tegelijk tonen als één doorlopende boom. `mergeGraphs`
(`src/domain/mergeGraphs.ts`) naait families op de brugpersonen (`tree_links`) én
op identiteit (genormaliseerde naam + geboortejaar) tot één graaf; ontdubbelt
personen/unions/parentLinks. Kiezer `LinkedTrees` (store `linkedFamilyIds` +
`toggleLinkedFamily`, gewist bij familiewissel): vink gekoppelde families aan;
families zonder toegang staan grijs met "toegang vragen" (gedeelde
`askFamilyAccess`, zelfde flow als brug-oversteken). Kleuraccent per herkomst-familie
(ring op de knopen, `originColorMap` in `theme.ts`) + mini-legenda. Alleen bij een
echte familie, niet tijdens "Bekijk als …"; forceert de "hele boom"-scope.

**Meerdere bijnamen (2026-07-10)** — `Person.nicknames?: string[]` (eerste = primair,
boom-label bij `preferredName:'nickname'`). Bewerkscherm: lijst van bijnaam-velden
(auto-opslaan); kaart toont primaire + teller (`'David' +3`), paneel de volledige
lijst. Zie mig 30.

**CSV-export + import round-trip (2026-07-10)** — export-knop in het familie-menu
(`FamilyMenu`, elk lid): `exportFamilyCsv` (`src/data/importTemplate.ts`) schrijft de
actieve boom naar CSV in (een superset van) het import-sjabloon. Kolom `db_id` =
echte database-id (identiteit voor re-import), leesbare `id`-slug (naam-jaar) voor de
relatie-verwijzingen. Import (`ImportFamily`, owner-only, weer aan): parser leest de
rijke velden; `geocodeImport` (`src/data/importGeocode.ts`) zoekt plaatsnamen op via
Nominatim (client-side, ~1/sec, met voortgang; naam gaat altijd mee, coördinaten
optioneel → geen wis bij mislukte geocode). Rij met `db_id` → bijwerken (incl.
woonplaatsen, autoritair vanuit CSV), zonder → nieuw; relaties ontdubbeld. Zie mig 31.
Grens: velden buiten het platte formaat (foto, geb.-maand/-dag, notities) worden bij
update níét aangeraakt; meerdere ouderparen/partners passen niet volledig in het CSV.

**"Bekijk als …" (2026-07-04, Opus-sessie)** — PowerBI-achtige owner-preview om de
zojuist geharde RLS te testen. **Faithful, server-side**: de echte RLS wordt opnieuw
gedraaid met een gesimuleerde identiteit (rol + optioneel persoon voor `is_self`),
géén namaak in de frontend. Frontend: `ViewAs`-type (`src/data/types.ts`), store-vlag
`viewAs`/`setViewAs` (gewist bij elke familiewissel), `SupabaseRepository` roept de
`_as`-RPC's aan wanneer viewAs actief is (repo-instantie gekeyd op viewAs → herlaadt),
owner-only `ViewAsControl` (oog-knop, topbar) + banner in `App.tsx`. Tijdens view-as
is alles **alleen-lezen** (`canEdit`/`canPropose` false) — een mutatie zou als de échte
owner draaien. Dekt het graph-leespad (95% van wat je ziet); directe-tabel-RLS
(avatars/places/mutaties) test je met een tweede account. i18n-sleutel `viewAs` in alle
4 talen.

**Security-review 2026-07-04** (Fable-sessie): volledige audit van RLS/RPC's/storage
/frontend-datalaag. Gefixt in mig 26–28 (zie tabel). Bewust open gelaten:
voorstellen-review-UI toont geen volledige diff van de payload (owner keurt deels
blind goed — server valideert nu wél de familie-grens; UI-diff is een latere
iteratie), BFS in `get_ego_graph` traverseert verborgen edges (inferentie, past bij
"verbergen is best-effort"), Nominatim-geocoding loopt client-side naar OSM (hoort
vermeld in privacy-uitleg), en `?backend=supabase`-demo blijft anon leesbaar voor
`public`-rijen (by design). Frontend-wijziging: `Union`/`ParentChildLink` kregen
optioneel `detailHidden?: boolean` (`src/data/types.ts`).

**Bewerken slaat automatisch op** (sessie 2026-06-23): het bewerkformulier
(`EditPerson`) heeft geen opslaan-knop meer; elke veldwijziging schrijft debounced
(700 ms) weg via `updatePerson`, met een subtiele "Opslaan…/Opgeslagen ✓"-status.
"Voornamen" is verplicht → bij een leeg veld wordt niet opgeslagen. De
verwijder-knop is een subtiele tekstlink. Een brug kan ontkoppeld worden in
`BridgeSection` (owner-only, RPC `remove_bridge`).

Bewerkformulier verder opgeschoond: **floating labels** (`FloatField`, pure CSS),
**zichtbaarheid als knoppen** (segmented, geen native picker meer), en **"toon in
boom" verwijderd** — de roepnaam regelt nu het label. De roepnaam wordt bij
*bestaande* personen niet meer auto-afgeleid: leeg roepnaam-veld = de volledige
voornaam als label in de boom (juist voor meerdelige namen als "Buk Sing"). De
auto-suggestie (eerste voornaam) blijft alleen bij het *toevoegen* van een nieuw
persoon. `preferredName` blijft als kolom bestaan (oude waarden behouden), maar is
niet meer in de UI instelbaar.

**Personen kopiëren tussen bomen** — in de UI "Personen **importeren**" genoemd
(component/RPC heten nog copy*) — (sessie 2026-06-23): `CopyPersons` (in het
familie-menu, owner van de actieve boom + ≥1 andere eigen boom). Kies een
bronboom → doorzoekbare aanvinklijst → kopieer. RPC `copy_persons` (migratie 19)
maakt nieuwe records in de doelboom en neemt de unions/parent_links mee waarvan
beide personen geselecteerd zijn. Foto's/bruggen gaan niet mee; `places` is
globaal dus plaats-verwijzingen blijven gedeeld. Bronkeuze is knoppen (geen
native picker).

**Aanknopen bij kopiëren** (migratie 20): een gekopieerde persoon kan verwant zijn
aan iemand die al in de doelboom staat. `CopyPersons` detecteert die grenspersonen
(verwant aan een geselecteerde persoon, zelf niet geselecteerd) en matcht ze op
**naam+geboortejaar** met de doelboom; de gebruiker vinkt aan welke aangeknoopt
worden. `copy_persons` krijgt dan een `p_anchors`-map (bron-id → bestaand doel-id):
voor anchors wordt geen nieuw record gemaakt en relaties worden aan het bestaande
knooppunt gehangen (met dedup van al bestaande relaties). NB: een relatieloze
persoon is alleen zichtbaar in **Tableau** (`flowLayout(fullGraph)`), niet in de
**Boom** (`egoLayout` toont alleen verbonden personen) — vandaar dat aanknopen nodig
is om kopieën in de boom-weergave te zien.

## Features gebouwd na de PoC/backend (samenvatting van 6–13)
- **Namen in eigen schrift + bijnaam** (cultuur-neutraal; vervingen de eerdere
  gesplitste Chinese velden). Getoond op kaart + node (eigen schrift) en kaart
  (bijnaam). **Voorkeursnaam** (migratie 15): per persoon kiezen welke naam het
  hoofd-label in de boom is — volledige naam (standaard), eigen schrift of
  bijnaam; `Person.preferredName`, helper `nativeSubline()` in `theme.ts`.
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

## Fixes & features (sessie 2026-06-20, deel 3)
- **Camera-foto fix**: de foto-editor toonde een zwart scherm. Oorzaak: `srcObject`
  werd in de `getUserMedia`-callback gezet terwijl `<video>` pas ná `setCameraOn(true)`
  gemount wordt — `videoRef.current` was nog `null`. Koppeling nu in een effect op
  `cameraOn` (`PhotoEditor.tsx`).
- **Voorkeursnaam** (migratie 15, `preferred_name`): per persoon kiezen welke naam
  als hoofd-label in de boom staat — volledige naam (standaard), eigen schrift of
  bijnaam. UI in `EditPerson` ("toon in boom"); `_build_graph` geeft `preferredName` mee.
- **Sterfjaar bij nieuw lid**: `AddRelative` heeft nu ook een sterfjaar-veld (de RPC
  kent het niet, dus gericht na-update zoals bij bewerken).
- **Import-knop tijdelijk verborgen** (front-end) tot de flow af is.
- **Bewerken toont alle naamvelden direct**: de "more details"-stap is weg; eigen
  schrift, bijnaam en "toon in boom" staan meteen open bij bewerken (`EditPerson`).
- **'Openbaar' uitgefaseerd**: de zichtbaarheidskeuze biedt alleen nog familie/privé.
  'openbaar' stelt data zonder login bloot via de `anon`-grant op
  `get_full_graph`/`get_ego_graph`, terwijl een publieke weergave nog niet bestaat.
  Een persoon die er al op staat ziet 'openbaar (uitgefaseerd)' zodat het terug te
  zetten is. **Nog open**: bestaande `public`-personen blijven via de API leesbaar
  tot ze terugzet zijn; een migratie (`public`→`family` en/of `anon`-grant intrekken)
  is nog niet gemaakt.
- **Privé alleen voor de owner** (migratie 16): `can_manage_person` telt sinds mig 14
  ook editors mee, waardoor editors privé-/`fully_hidden`-personen volledig zagen. In
  de lééspaden (`persons_select`-policy + `_build_graph.can_full`) nu
  `is_owner_of_person` i.p.v. `can_manage_person`. Editors/lezers zien een privé-
  persoon voortaan als "verborgen persoon"-silhouet; owner ziet 'm volledig; `is_self`
  blijft. Schrijfrechten ongewijzigd (editors beheren nog gewoon).
- **Rollen uitgelegd in de gids**: sectie "Rollen: wie mag wat" in `guideContent.ts`
  (NL/EN/ZH/ID) als per-rol overzicht — drie blokken (beheerder/bewerker/lezer) met
  een **bullet-lijst rechten** per rol, incl. mede-owner maken en de privé-regel.
  Verouderde "meer details"- en "openbaar"-teksten bijgewerkt. `GuideItem` zonder
  `label` rendert als gewone bullet (`HelpGuide.tsx`). Zie rol-overzicht hieronder.

## Portfolio-exposure (sessie 2026-06-22)
Doel: Bloom als portfolio-stuk inzetten voor exposure in **datavisualisatie &
data­storytelling**. Drie toevoegingen, alle teksten in NL/EN/ZH/ID.
- **"Over de maker"-paneel** (`src/ui/AboutCard.tsx`): korte bio die Bloom framet
  als **tweede deel in een persoonlijke serie levensvisualisaties** (deel 1 =
  WeeklyPulse, `https://weeklypulse.vizcraft.nl/`). Neutrale toon ("complexe
  familierelaties", géén BI-specialist-claim, AI als co-piloot). Links naar
  vizcraft.nl / WeeklyPulse / LinkedIn. Store-state `aboutOpen`/`setAboutOpen`.
  Bereikbaar via het ⋯-menu ("Over de maker") **en** via de credit-knop in de
  legenda. i18n: `topbar.about` + sectie `about.*`.
- **Storytelling-legenda**: extra `legend.story`-regel (ontwerpgedachte: relaties
  zitten in vorm/kleur/lijnsoort i.p.v. tekst) in beide weergaven + credit-knop
  `legend.byMaker` ("Ontworpen door Chie-Yong Lai") die het paneel opent. CSS:
  `.about-*`, `.legend-story`, `.legend-credit` in `index.css`.
- **Deelkaart/SEO** (`index.html`): description, author, canonical, Open Graph +
  Twitter-tags → `https://bloom.vizcraft.nl/`. OG-afbeelding `public/og-image.png`
  (1200×630, gemaakt van een Habsburg-tableau-screenshot). **Na deploy** de cache
  verversen via de LinkedIn Post Inspector.
- Gecommit + gepusht naar `main` (Netlify auto-deploy).

## Git nu via SSH (belangrijk voor Termius/mobiel)
- Alle git-repo's op deze Mac (incl. familytree) zijn omgezet van **HTTPS → SSH**
  (`git@github.com:chieyong/<repo>.git`). Aanleiding: een Personal Access Token
  stond in platte tekst in de familytree-remote-URL (lek). Beide oude PAT's zijn
  ingetrokken; het Keychain-token is gewist.
- Auth loopt nu via SSH-sleutel **`~/.ssh/id_ed25519`** (ed25519, **zonder**
  passphrase → werkt vlot in een Termius-sessie ín de Mac). `git push`/`pull`
  hebben geen token meer nodig.
- **Nieuwe clones**: pak de **SSH**-URL (groene Code-knop → tab SSH). Beland je per
  ongeluk op een HTTPS-remote → `git remote set-url origin git@github.com:chieyong/<repo>.git`.

## Bijdrager-rol + voorstellen (sessie 2026-06-24)
Nieuwe rol **`contributor` (Bijdrager)**: mag niet direct schrijven (telt niet als
owner/editor in `can_manage_person`), maar mag **wijzigingen voorstellen**.
- **Indienen**: in het persoonspaneel ziet een bijdrager "Wijziging voorstellen" →
  `EditPerson` in `proposalMode` (geen auto-opslaan, knop "Voorstel indienen") →
  `submitPersonProposal` schrijft een rij in `change_proposals` (kind `person_update`,
  payload = dezelfde kolommen als `updatePerson`).
- **Afhandelen**: owner/editor ziet een banner "N open voorstellen" → `ProposalsReview`
  (modal) → goedkeuren (RPC `resolve_proposal` past de wijziging toe) of afwijzen.
- Rol is toewijsbaar in Delen → Leden (en bij uitnodigen).
- **Fase 2b** (migratie 24): bijdrager kan ook **nieuwe personen** (`person_add`) en
  **koppelingen aan bestaande personen** (`relation_add`) voorstellen — in het
  proposing-paneel staat naast de velden ook `AddRelative` in `proposalMode`.
  `resolve_proposal` past bij goedkeuren dezelfde inserts toe als add_relative/
  linkRelative. Nog open (fase 2c): **verwijderen** voorstellen, en **foto's**.
- Bestanden: `ProposalsReview.tsx`, `EditPerson.tsx` (proposalMode), `PersonPanel.tsx`
  (canPropose), `App.tsx` (banner/fetch), `mutations.ts` (submit/list/resolve),
  migraties 22+23.

## Atlas-view (sessie 2026-06-26)
Derde weergave naast **Boom | Tableau**: de **Atlas** (intern nog `mode === 'globe'`,
topbar-knop + `?view=globe`). Draaibare **orthografische** bol (d3-geo) met
landmassa (`world-atlas` land-110m, in de bundel) + graticule. Elke **stip** is een
geboorteplaats (kleur = stamtak); een **schakelaar** bovenin wisselt de verhaallaag:
- **Migratie** — grootcirkelboog van geboorteplaats ouder → geboorteplaats kind
  (familie verspreidt zich over generaties). Stip hol = overleden.
- **Levensreis** — het volledige geografische **levenspad** per persoon: geboorte →
  **woonplaatsen** (chronologisch, kleine stippen) → overlijden. De sterfteplaats staat
  als **✕** aan het eind; geboortestippen zijn hier altijd gevuld (helder startpunt).
  Data uit `Person.residences[]` (place + `from`-jaar voor de volgorde).

De actieve laag staat in de store (`globeLayer`, `setGlobeLayer`, default `migration`,
te zetten met `?layer=migration|life`) zodat de **legenda zich per laag aanpast**
(alleen wat op dat moment telt). Interactie: **slepen** draait, **scrollwiel** én
**+/−-knoppen** (rechts) zoomen, **tik op een stip** selecteert de persoon (zelfde
kaart als de boom). Auto-fit: een geklemde familie zoomt in, een intercontinentale
toont de hele bol; bij mount een korte intro-fly-in naar het zwaartepunt (uit bij
reduced-motion). Achterkant-stippen/✕ worden gecullt (hoekafstand); bogen worden door
`clipAngle(90)` aan de horizon afgesneden.

De **legenda** staat op desktop (≥900px) standaard open en blijft open bij het
wisselen van weergave (sluiten via de knop); de klik-buiten-backdrop is daar uit
zodat hij het slepen van de bol niet blokkeert. Op smal scherm: dicht, met backdrop.

**Mobiel/interactie-verfijningen (sessie 2026-06-26, deel 2):**
- **Rotatiegevoeligheid = `(180/π)/scale`** (graden per pixel): een punt blijft onder
  de vinger, dus ingezoomd draait de bol vanzelf rustiger (loste "te gevoelig bij
  inzoomen" op).
- **Pinch-zoom** (twee vingers) naast scrollwiel en +/−-knoppen; pointer-events met
  een `Map` van actieve pointers, één vinger = draaien.
- **Zoom-bereik 0.6–60×** (was max 6×) zodat je echt op landniveau kunt inzoomen.
- **Kaart op `countries-50m`** (was `land-110m`): fijnere kustlijn + subtiele
  landsgrenzen (mesh) → NL herkenbaar bij inzoomen. (+~690 KB precache, bewust.)
- **Mobiele indeling herzien** (de toggle botste/verdween achter andere knoppen):
  vier hoeken i.p.v. gestapelde groepen — **linksboven** `Demo ▾` (familie/dataset,
  dropdown opent omlaag), **rechtsboven** Boom·Tableau·Atlas, **linksonder** Legenda,
  **onder-midden** de Migratie·Levensreis-toggle (rechterhelft vrij). `.globe-layers`
  kreeg `z-index: 12` zodat de toggle nooit achter de topbar valt. Credit-regel in de
  legenda flink subtieler.

**Datasets:** **`diaspora` (in de UI gelabeld "Demo") is nu de default-demo** — een
Chinees-Indonesisch/Maleisische familie die over drie generaties van Hongkong,
Penang/KL, Medan/Jakarta/Bandung naar Amsterdam/Den Haag/Rotterdam migreert, met
geboorte-, sterfte- én woonplaatsen. Toont de Atlas op z'n best. De oude Nederlandse
**`demo` is verborgen** in het familie-menu (`PRESET_IDS = ['diaspora','habsburg']`)
maar blijft bestaan en bereikbaar via `?data=demo`. Fixtures-only (niet in Supabase
geseed; placeholder-UUID in `DATASET_FAMILY_ID`). Bestand:
`src/data/fixtures/diaspora.ts`; gewired in `store.ts`/`App.tsx`/`FamilyMenu.tsx`
(+ `family.presetDiaspora` i18n).

Bestanden: `src/layout/globeLayout.ts` (pure data-laag: punten + migratie-/
levensbogen + centroid + spread), `src/ui/GlobeCanvas.tsx` (projectie, rotatie,
zoom-knoppen, render), `theme.ts` (paletten kregen `globeOcean/globeLand/globeGraticule`),
`store.ts` (`ViewMode` + `'globe'`, `GlobeLayer` + `globeLayer`/`setGlobeLayer`),
`App.tsx` (knop + conditioneel renderen + per-laag globe-legenda + legenda-default),
`i18n.ts` (`topbar.globe` = "Atlas", sectie `globe.*` incl. `zoomIn/zoomOut`,
`legend.globe*` incl. `globeDeath` in nl/en/zh/id), `index.css` (`.globe-*`,
`.swatch-x`). Deps: `d3-geo`, `topojson-client`, `world-atlas` (+ types).

**Data**: leest de bestaande `birth.place`/`death.place`/`residences` mét `lat/lon`.
De **demo-familie** kreeg intercontinentale herkomst (Bandung/Indonesië, Paramaribo/
Suriname, Toronto/Canada) + sterfteplaatsen (Alicante, Nice, Delft) + **woonplaatsen**
voor de levenspaden (Hendrik: Rotterdam→Amsterdam→Barcelona→Alicante; Johanna: Bandung→
Den Haag→Delft; Willem: Utrecht→Parijs→Nice) zodat beide verhaallagen rijk zijn. De
**Habsburg-set** heeft van zichzelf al geboorte-/sterfteplaatsen → vol Europees
migratieweb (nog geen residenties).

### Fase 2a — geboorte- & sterfteplaats invoerbaar (sessie 2026-06-26, deel 3) ✅
`EditPerson` heeft nu **geboorteplaats- en sterfteplaats-velden** met **type-ahead
geocoding via OpenStreetMap Nominatim** (`src/data/geocode.ts`, client-side, CORS,
geen API-sleutel; 450 ms debounce, vanaf 2 tekens, OSM-bronvermelding in de dropdown).
Component `src/ui/PlaceField.tsx` (autocomplete + wissen). Opslaan: `setPersonPlace`
in `mutations.ts` zet de plaats in de gedeelde `places`-tabel (open RLS voor ingelogd,
dedup op naam+coords) en koppelt via `birth_place_id`/`death_place_id`. **Geen migratie
nodig** — `_build_graph` las die kolommen al. Echte families verschijnen nu dus op de
Atlas (stippen + migratiebogen + levensreis-begin/eind) zodra ze plaatsen invullen.
i18n `edit.birthPlace/deathPlace/placeSearching/placeNoResults/placeClear/placeAttribution`
in nl/en/zh/id; CSS `.place-*`. **Alleen bij direct bewerken** (owner/editor); in
proposalMode (bijdrager) nog geen plaatsvelden.

### Fase 2b — woonplaatsen (residenties) (sessie 2026-06-26, deel 4) ✅ (code)
`EditPerson` heeft nu een **Woonplaatsen-sectie**: lijst van residenties (plaats · jaar)
met verwijderen, plus een toevoegrij (PlaceField + vanaf-jaar → "+ Toevoegen").
Mutaties `addResidence`/`removeResidence` in `mutations.ts` schrijven direct op de
`residences`-tabel (RLS-write = `can_manage_person`, **geen schrijf-RPC nodig**).
`Residence`-type kreeg `id?`; `_build_graph` geeft residenties nu mee (**migratie 25**).
Na het draaien van mig 25 tonen de levenspaden op de Atlas (geboorte → woonplaatsen →
overlijden) ook voor échte families. Nog open: plaatsvelden in `AddRelative` + de
woonplaatsen-sectie ook in proposalMode (bijdrager); evt. eind-jaar (`to_year`) invoeren.

## Rollen (samenvatting)
- **Owner (beheerder)**: alles van editor + ledenbeheer (uitnodigen, rollen wijzigen,
  verwijderen), familie hernoemen/verwijderen, bruggen leggen. **Enige die privé-
  personen ziet.**
- **Editor (bewerker)**: personen/relaties toevoegen·bewerken·verwijderen, foto's,
  uitnodigen. Géén ledenbeheer, familie-instellingen of bruggen; ziet geen privé.
- **Contributor (bijdrager)**: als viewer (geen directe schrijfrechten, geen privé),
  maar mag **wijzigingen voorstellen** die owner/editor goedkeurt (zie hierboven).
- **Viewer (lezer)**: alleen-lezen op familie-zichtbare data; geen privé; mag wel het
  eigen "dit ben ik"-knooppunt aanpassen (`is_self`).
- **Mede-owner maken** (frontend-only, geen migratie): in Delen → Leden kan een owner
  een ander lid op **beheerder** zetten (rol-keuze heeft nu ook 'owner', met
  bevestiging). De keuze toont voor álle andere leden (ook owners) zodat promoveren
  omkeerbaar is; je eigen rol kun je niet wijzigen → er blijft altijd ≥1 owner. RLS
  stond dit al toe (`members_update` = owner; enum bevat 'owner'). `updateMemberRole`
  accepteert nu `owner`.

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
- **Nog live te verifiëren** (ingelogd, niet-headless, met 2 accounts/rollen):
  (a) privé-persoon (mig 16) → bekijk als editor/lezer: hoort een "verborgen
  persoon"-silhouet te zien, owner ziet 'm volledig; (b) mede-owner maken via
  Delen → Leden + terug kunnen draaien; (c) viewer ziet geen bewerk-knop en kan
  niets opslaan (mig 21, ook op eigen oude toevoegingen); (d) Bijdrager: voorstel
  indienen (wijziging / nieuw persoon / koppeling) → owner/editor ziet de banner
  en kan goedkeuren (past toe) of afwijzen.
- **Open privacy-actie**: bestaande `public`-personen blijven via de `anon`-grant op
  `get_full_graph`/`get_ego_graph` leesbaar zonder login. De UI biedt 'openbaar' niet
  meer aan, maar er is nog **geen migratie** die bestaande `public`→`family` zet of de
  `anon`-grant intrekt. Overweeg dat als de blootstelling echt dicht moet.
- **Bijdrager fase 2c** (later): voorstellen om personen/relaties te **verwijderen**
  en om **foto's** toe te voegen; evt. een diff-weergave (oud → nieuw) in het
  review-scherm, en een telling per familie.
- Bruggen v2 (later, zie design-doc): begrensd alleen-lezen oversteken, één
  doorlopend gestikt beeld, profielsync tussen de spiegel-knopen. (Brug intrekken
  in de UI is gedaan — mig 18 / ontkoppelen.)

## Conventies
- Commits eindigen met `Co-Authored-By: Claude <noreply@anthropic.com>` (neutraal; voorheen "Claude Fable 5").
- `service_role`-key nooit committen/tonen; anon/publishable key is public-safe
  (staat in gitignored `.env.local` + de hosting-env).
