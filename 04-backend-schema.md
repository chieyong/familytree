# Stop-moment: Backend-schema & RLS (Supabase)

> Status: **ontwerp volledig akkoord** (incl. §9, 2026-06-15). Volgende stap:
> migratie 1.
> Kernbeslissingen: (A) één `families`-container, overlappende bomen later (§8);
> (B) verborgen personen als **stub-rij** (alleen intra-tree); (C) datums als
> **losse kolommen**; toegang **besloten, deelbare link + goedkeuring**, geen
> ontdekking op achternaam; bewerken **eigenaarschap-gebonden**; grens tussen
> bomen geopend door **de onthullende kant**.

---

## 1. Tabellen

Enums: `visibility (public|family|private)`, `union_type`, `union_end_reason
(divorce|separation|death)`, `parent_role (biological|adoptive|step|foster)`,
`date_precision (exact|approx|before|after)`, `member_role (owner|editor|viewer)`,
`sex (m|f|x)`.

```
families          id, name, created_at
profiles          id→auth.users, display_name            -- 1:1 met Supabase Auth
family_members    family_id, profile_id, role, status (pending|active),
                  self_person_id   -- wie ben "ik" in deze boom
family_invites    id, family_id, token, role, created_by, expires_at, revoked
                  -- deelbare uitnodigingslink (niet e-mail-gebonden)
places            id, name, lat, lon, wikidata_id
persons           id, family_id, given_names[], family_name, display_name, sex,
                  birth_year/month/day/precision, birth_place_id,
                  death_year/month/day/precision, death_place_id,
                  visibility, field_visibility jsonb, fully_hidden bool,
                  managed_by→profiles, created_by→profiles, wikidata_id, notes
residences        id, person_id, place_id, from_year, to_year   -- tijdreeks, wereldbol
unions            id, family_id, partner_a, partner_b, type,
                  start_year/month/day, end_year/month/day/reason, visibility
parent_links      id, family_id, parent_id, child_id, role, union_id, start_year,
                  visibility
```

- **1-op-1 met de TS-types.** `FuzzyDate` → losse `_year/_month/_day/_precision`-kolommen (C): queryable voor de tijdas en sortering in Tableau.
- **`field_visibility jsonb`** draagt de per-veld-overrides; de strengste-wint-regel (`strictestVisibility`) blijft de bron van waarheid en wordt server-side herhaald.
- **`managed_by`** = fijnmazig gedeeld beheer binnen de familie (A).
- Alles hangt aan `family_id` zodat overlappende grafen later een additieve stap zijn, geen herontwerp.

## 2. Toegang: besloten & op uitnodiging

Een échte familieboom is **privé en op uitnodiging** (beslissing 2026-06-15).
Zonder uitnodiging + login zie je niets — er is geen half-openbare boom met
levende familieleden.

- **Uitnodigen via deelbare link mét goedkeuring** (beslissing 2026-06-15): een
  `owner`/`editor` maakt een `family_invites`-link (token + rol). Wie de link
  opent en inlogt, wordt een **`pending`** lid (`family_members.status`); de owner
  keurt goed → `active`. `pending` leden zien nog niets (`is_member` checkt
  `status = 'active'`).
- **Geen ontdekking op achternaam.** Er is geen zoek- of lijstfunctie; een
  uitgelogde bezoeker ziet **alleen de demo**. De uitnodigingslink wijst je naar
  precies de juiste boom — dat lost het "welke Lai is de mijne"-probleem op zonder
  lidmaatschap aan vreemden te lekken.
- **`public`** is géén default maar een bewuste *publiceer*-actie: een owner kan
  losse rijen (bijv. overleden voorouders) publiek zetten voor een deel-link. De
  **demo-data** (Habsburg, demo-familie) is op die manier `public` — zichtbaar
  zonder login, als etalage.
- **Login**: Supabase Auth met Google OAuth + magic link (wachtwoordloos),
  vriendelijk voor minder technische familieleden.

## 3. Privacy: twee lagen

**Laag 1 — RLS als slot (deny-by-default, staat al aan).**
Helper-functies (`security definer`):
- `is_member(family_id)` — zit `auth.uid()` in deze familie?
- **Lezen**: een lid ziet rijen van zijn familie met `visibility in (public, family)`; `private` alleen als `managed_by = auth.uid()` of rol `owner`. Niet-leden zien **niets** van een besloten familie; alleen bewust gepubliceerde `public`-rijen (en de demo) zijn zonder lidmaatschap zichtbaar.
- **Schrijven (eigenaarschap-gebonden, beslissing 2026-06-15):**
  - *Toevoegen* van een persoon: rol `editor`/`owner`; `created_by`/`managed_by` worden de maker.
  - *Wijzigen/verwijderen* van een persoon: alleen de beheerder (`managed_by = auth.uid()`) of een `owner`.
  - *Relaties* (`unions`, `parent_links`): toevoegen/wijzigen mag wie minstens één van de twee eindpunten beheert, of een `owner`.
- **Zelfbeschikking wint**: een lid dat aan een knooppunt gekoppeld is (`self_person_id`) mag de zichtbaarheid van *zijn eigen* persoon altijd strenger zetten, ongeacht wie de beheerder is.

**Laag 2 — leespad via RPC met stub-rijen (B).**
RLS kan geen *halve* rij teruggeven, en het is precies de bedoeling dat de topologie heel blijft. Daarom loopt het lezen via twee Postgres-functies die de `FamilyRepository`-interface 1-op-1 spiegelen:

```
get_ego_graph(person_id uuid, depth int) returns jsonb   -- Explorer
get_full_graph(family_id uuid)          returns jsonb     -- Tableau
```

Elke functie doet de **traversal** (recursieve CTE = de BFS die nu in de app zit) én de **zichtbaarheid** in één keer, en levert een `FamilyGraph`-JSON terug. Een persoon die de kijker niet volledig mag zien, maar wel structureel bereikbaar is, komt terug als **stub**: `{ id, hidden: true, displayName: "Verborgen persoon" }` met zijn graafpositie intact — zodat de silhouet-node en de tak blijven staan. Relaties tonen we zolang beide eindpunten minstens als stub aanwezig zijn.

**Silhouet = alleen binnen je eigen boom** (beslissing 2026-06-15). Stubs houden de topologie heel voor afgeschermde personen *in je eigen familie*. De grens naar een ándere boom is hard: de traversal volgt geen randen naar personen die niet in jouw boom zijn ingesloten — die komen niet terug, ook niet als silhouet (zie §8).

**Volledig verbergen** (`fully_hidden = true`, alleen door de persoon zelf in te stellen) is de zwaardere keuze binnen je eigen boom: dan komt de persoon óók niet als stub terug en breken navigatiepaden bewust — zelfbeschikking boven topologie.

→ Frontend: één veldje `hidden?: boolean` op `Person`; de view rendert dan het silhouet. `KinshipService` wordt visibility-bewust voor de afgeleide-onthulling (zichtbare halfbroer ⇒ verborgen ouder) — dat blijft, zoals besproken, app-laag werk naast de DB.

## 4. "Ik" = ingelogde gebruiker

`family_members.self_person_id` koppelt een account aan zijn knooppunt in de boom. De store-default `DATASET_EGO` wordt vervangen door deze waarde; het wisselbare perspectief (de "bekijk vanuit"-knop) blijft daar bovenop werken.

## 5. Repository-swap

`SupabaseRepository implements FamilyRepository`:
- `getFullGraph()` → `rpc('get_full_graph', { family_id })`
- `getEgoGraph(id, depth)` → `rpc('get_ego_graph', { person_id, depth })`
- `getPerson`, `search` → directe selects (RLS dekt ze af)

De UI verandert niet: hij kent alleen `FamilyGraph`. In `App.tsx` wisselt één regel van `FixtureRepository` naar `SupabaseRepository`. De fixtures blijven bestaan als offline-/test-pad.

## 6. Migraties & seed

- SQL in `supabase/migrations/` in de repo; via de GitHub-koppeling deployt een push automatisch. `supabase/config.toml` erbij.
- **Seed**: een eenmalig script zet de bestaande fixtures (demo-familie + `habsburg.json`) om naar rijen, gedraaid met de service_role-key (lokaal, key niet in de repo). Daarmee is de demo meteen gevuld en testbaar.
- Client-config: `VITE_SUPABASE_URL` + publishable key in `.env.local` (gitignored) en als Netlify-env-vars.

## 7. Open punten / risico's

- **Per-veld-zichtbaarheid** dwingen we voorlopig in het RPC-leespad af (velden nullen), niet met column-level security — pragmatisch voor de PoC.
- **Performance**: recursieve CTE op familieschaal (honderden–duizenden) is prima; bij zeer grote bomen wordt `get_full_graph` zwaar → later paginatie/viewport-fetch.
- **Auth-flow** (login, familie aanmaken, uitnodigingslink + goedkeuring, jezelf aan een persoon koppelen) is een apart blok ná het schema — eerst de datalaag staan, dan login.

## 8. Overlappende bomen (latere fase)

Scenario: een Lai-boom en een Man-boom, gedeeld via een **brugpersoon** (de
partner). Beslissingen (2026-06-15), nu nog niet gebouwd maar wel
voorwaartscompatibel gehouden:

- **Harde grens, geen achterdeur.** Vanuit Lai zie je de brugpersoon, maar niet
  haar Man-tak. De traversal blijft binnen de eigen boom; cross-tree personen
  worden niet getoond — **ook niet als silhouet** (anders dan intra-tree
  afscherming). Dit valt vanzelf uit "traversal volgt alleen edges naar personen
  in deze boom".
- **Wie opent de grens: de onthullende kant.** De Man-eigenaar (of de brugpersoon
  zelf) verleent een **scoped** toestemming ("Lai mag vanaf mij N generaties
  terug"). De Lai-beheerder kan er hooguit om vragen — je trekt niet eenzijdig
  andermans data binnen. De eigen zichtbaarheid van elke persoon op dat pad blijft
  gelden (strengste wint).
- **Voorwaartscompatibel houden nu**: géén harde CHECK dat een `union`/`parent_link`
  binnen één `family_id` blijft, zodat relaties later families kunnen overbruggen;
  een persoon-in-twee-bomen koppeltabel (`person_trees`) + cross-tree
  toestemmings­grants zijn dan een additieve stap, geen herontwerp.

## 9. Gedeelde feiten & perspectivische zichtbaarheid

Een relatie is een **gedeeld feit**: een huwelijk gaat over beide partners, een
ouder–kind-link over ouder én kind. Kale strictest-wins laat één partij dat feit
eenzijdig dichtzetten — wat voor de ander voelt als uitwissing van zijn eigen
geschiedenis, én topologie breekt waar anderen van afhangen (twee kinderen zijn
alleen halfbroers omdat de gedeelde ouderlink bestaat). De app is al
ego-centrisch; zichtbaarheid kan dus een functie van **(kijker, pad)** zijn in
plaats van één globale schakelaar.

### Aanbeveling: bestaan globaal, detail & prominentie perspectivisch

- **Splits bestaan en detail** (idee 2 als fundament):
  - **`existence_visibility`** — verschijnt de relatie überhaupt? Default `family`
    (breed). Houdt topologie heel → halfbroer-afleiding en navigatie blijven werken.
  - **`detail_visibility`** — datums, type, scheidingsreden. Volgt strictest-wins +
    `field_visibility`.
- **Perspectivisch = alleen prominentie/detail, niet bestaan** (idee 1, ingeperkt).
  Per kant een "toon vanaf mijn kant"-vlag die de relatie in de Explorer/ego-view
  dempt of weglaat als je vanaf die persoon kijkt — maar het bestaan blijft globaal
  consistent. Zo vermijden we (i) de **Tableau-incoherentie** (geen pad → perspectief
  ondefinieerbaar) en (ii) de **discrepantie bij twee kanten** (bestaan is overal
  gelijk; alleen nadruk verschilt, en dat is geen tegenspraak).
- **Pure per-(kijker,pad)-zichtbaarheid van het bestaan wijs ik af**: ondefinieerbaar
  in Tableau, duur in de CTE, en verwarrend.

### De restvraag — het bestaan zélf verbergen — is symmetrie-afhankelijk

Geen one-size antwoord; het hangt af van wie het feit "bezit":

- **Symmetrisch (`union`):** gelijkwaardige mede-eigenaars. Bestaan verbergen kan
  alleen met **toestemming** van de ander (pending-state). Zonder toestemming blijft
  het bestaan; elke partij mag wel detail dempen en de eigen-kant-prominentie uitzetten.
- **Asymmetrisch (`parent_link`):** de identiteitsdragende kant — het **kind/de
  nazaat** — heeft de sterkere claim op het bestaan van zijn eigen afkomst. De ouder
  dempt eigen-kant-prominentie + detail, maar wist de afkomst niet uit. (Spiegelt
  afstammings-/adoptierecht.)
- **Overledene:** geen "zelf" om te spreken → governance via `managed_by` +
  owner-override; bestaan van afstammingslijnen **default open** (geschiedenis;
  privacy van overledenen is zwakker), strictest-wins alleen op detail.

Dus een **blend**: toestemming (symmetrisch) en zelfbeschikking-met-erkenning
(asymmetrisch/overleden), niet pure perspectivische fallback.

### Stress-test

| Scenario | Uitkomst in dit model |
|---|---|
| 1. Scheiding + nieuw leven | Union-bestaan blijft (B's geschiedenis); A dempt detail + eigen-kant-prominentie; volledig verbergen alleen met B's toestemming. |
| 2. Halfbroer-afhankelijkheid | Bestaan van beide ouderlinks blijft (elk kind bezit eigen afkomst); P's identiteit kan stub worden; **"er is een gedeelde ouder" blijft afleidbaar** — zie eerlijkheid. |
| 3. Vervreemde ouder | Kind wint voor bestaan eigen afkomst; ouder dempt eigen-kant + detail, kan niet uitwissen. |
| 4. Overleden voorouder | `managed_by`/owner spreekt; bestaan afstamming default open; detail strictest-wins. |
| 5. Discrepantie twee kanten | Verdwijnt: bestaan is globaal consistent; alleen nadruk verschilt per ego — geen tegenspraak. |

### Schema-impact

- `unions` & `parent_links`: vervang `visibility` door **`existence_visibility`** +
  **`detail_visibility`** (enum `visibility`, default `family`).
- Per-kant prominentie: `surface_from_a`/`surface_from_b` (unions),
  `surface_from_parent`/`surface_from_child` (parent_links), bool default true.
- Toestemming: tabel **`relationship_existence_requests`** (relatie-soort, relatie-id,
  `requested_by`, status `pending|approved|denied`, `responded_by`). `existence_visibility`
  daalt pas bij approval, afgedwongen via RPC/trigger — niet via rauwe update.
- RLS: lezen op edges kijkt naar `existence_visibility` (grof backstop);
  detail-maskering gebeurt in de RPC. Schrijven blijft eigenaarschap-gebonden;
  verlagen van `existence_visibility` mag niet direct.
- RPC's: de recursieve CTE beslist per edge of het bestaan zichtbaar is (globaal,
  set-based → goedkoop), nullt detailvelden bij ontoereikende `detail_visibility`, en
  gebruikt de **richting die de CTE toch al bijhoudt** (kom ik via partner/ouder/kind
  binnen) om eigen-kant-prominentie toe te passen in de ego-view. Tableau negeert
  prominentie (alleen bestaan).
- Frontend: `Person.hidden?` blijft (stub). Op de relatie/`LayoutLink` komt erbij:
  `detailHidden?: boolean` (gedempte/minimale edge) en `deemphasized?: boolean`
  (eigen-kant-prominentie uit in Explorer).

### Interactie met bestaande beslissingen

- **`strictestVisibility`**: blijft de regel voor **detail** + persoon-velden; voor
  relatie-**bestaan** vervangen door "default zichtbaar; verlagen = consent
  (symmetrisch) / verliest van identiteitsclaim (asymmetrisch)".
- **stub-rijen (B)**: onveranderd intra-tree; edges krijgen een parallel "detail-stub"
  (bestaan zichtbaar, detail leeg).
- **`fully_hidden`**: onveranderd (nucleair, persoon zelf). Gevolg: edges naar zo'n
  persoon vervallen voor anderen → mogelijke breuk in andermans lijn = geaccepteerde,
  consistente prijs.
- **zelfbeschikking-overruled-`managed_by`**: **verfijnd** — sterk voor je eigen node,
  eigen-kant-prominentie en detail; **begrensd** voor gedeeld bestaan (symmetrisch:
  consent nodig).
- **owner-override**: blijft; owners keuren bestaan-verzoeken goed en spreken voor
  overledenen.

### Performance

Bestaan/detail zijn globale, set-based checks (goedkoop). Prominentie hergebruikt de
pad-richting die de CTE al draagt → bescheiden meerkost. We vermijden bewust
per-(kijker,pad)-bestaan, dat de CTE in een dure pad-afhankelijke zoektocht zou
veranderen. **PoC-pragmatisch:** nu de split-kolommen + "bestaan default zichtbaar" +
detail-maskering in de RPC; de consent-tabel en prominentie-vlaggen wel als kolommen
toevoegen maar het gedrag later bouwen (voorwaartscompatibel).

### Eerlijkheid: het inferentie-lek

"Verborgen" is **best-effort tegen casual kijken, niet tegen een vastberaden
familielid dat redeneert.** Uit de zichtbare omgeving valt veel af te leiden: een
zichtbare halfbroer impliceert een gedeelde ouder (scenario 2); een gat in een
tijdlijn suggereert een verzwegen huwelijk; een kind dat in de boom van een neef
opduikt verraadt een ouder. Stubs en gedempte edges verbergen identiteit/detail, niet
het *patroon*. Voor een écht geheim is de enige garantie: het niet invoeren, of
`fully_hidden` (dat topologie breekt — en die breuk is zélf een signaal). Productcopy
mag een afschermend familielid dus **geen volledige onzichtbaarheid voor insiders**
beloven — alleen minder prominentie en bescherming tegen toevallige ontdekking en
tegen buitenstaanders (die sowieso niets zien).

### Beslispunten (§9)

**Gekozen 2026-06-15:** (1+2) ja — split `existence_visibility` + `detail_visibility`,
ingeperkt perspectief; (3) symmetrie-afhankelijke blend; (4) nu split +
bestaan-default-zichtbaar + detail-maskering, consent-tabel + prominentie-vlaggen
voorwaartscompatibel.

1. **Herframe**, ingeperkt: bestaan globaal-consistent, perspectivisch alleen voor
   detail/prominentie — akkoord?
2. **Bestaan vs. detail splitsen** (`existence_visibility` + `detail_visibility`) —
   ja/nee?
3. **Restvraag** (bestaan verbergen): symmetrie-afhankelijke **blend** (consent bij
   union, identiteitsclaim-wint bij parent_link, owner/managed bij overledene) — of
   liever één uniforme regel?
4. **PoC-omvang**: nu split + bestaan-default-zichtbaar + detail-maskering; consent-tabel
   + prominentie-vlaggen alleen voorwaartscompatibel — akkoord?

---

## Voorgestelde bouwvolgorde na akkoord

1. Migratie 1: tabellen + enums + RLS-policies.
2. Migratie 2: `get_ego_graph` / `get_full_graph` (traversal + stubs).
3. Seed-script (demo + Habsburg).
4. `SupabaseRepository` + client-config; swap in `App.tsx` achter een vlag.
5. Pas dáárna: auth-flow en CRUD.
