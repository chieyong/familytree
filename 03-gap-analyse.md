# Gap-analyse — Familieboom proof-of-concept

> Eerlijke eindstand van deze sessie: wat werkt, wat is nog mock, en waar
> zitten de grootste risico's voor de volgende fase.

## Wat aantoonbaar werkt

- **Datamodel** (`src/data/types.ts`): graph met `Person`, `Union` en per-ouder `ParentChildLink`, tijdsdimensie via `FuzzyDate`, zichtbaarheidsvlaggen op persoon/veld/relatie. Stress-getest door twee datasets: de fictieve familie (scheiding, hertrouwing, halfsiblings, stiefvader, adoptie) én 85 echte Habsburgers (1415–1580, neef-nichthuwelijken, hertrouwingen). Het model hoefde voor geen van beide aangepast te worden — dat is het sterkste bewijs dat het fundament klopt.
- **Afgeleide verwantschap** (`src/domain/kinship.ts`): siblings (vol/half/stief) worden nergens opgeslagen, altijd afgeleid. De afgesproken `strictestVisibility()`-regel staat er als typed functie.
- **Strikte scheiding data ↔ UI**: de visualisatie kent alleen `FamilyGraph` via de async `FamilyRepository`-interface. De dataset-switch (demo ⇄ Habsburg) bewijst dat de UI data-onafhankelijk is; een echte API is straks één class.
- **Wikidata-loader** (`scripts/fetch-habsburg.mjs`): crawlt vanaf Karel V (Q32500) via vader/moeder/echtgenoot/kind, parseert huwelijkskwalificaties (begin, einde, reden), plaatsen mét coördinaten (klaar voor de wereldbol), NL-labels met EN-fallback, en cachet naar JSON zodat de demo offline draait.
- **Kunstwerk-view "levenslijnen"**: tijdas-compositie waar positie data draagt; semantische zoom (namen bij inzoomen); schaalt visueel van 21 naar 85 personen.
- **Navigatie-view**: ego altijd exact gecentreerd (symmetrische layout + vaste camera, schaal veert mee), spring-animaties bij hernavigeren, depth-terugval (2 → 1) bij zeer vertakte families.

## Wat nog mock of bewust beperkt is

| Onderdeel | Status |
|---|---|
| Backend | Geen — `FixtureRepository` is in-memory. `getFullGraph()` is een PoC-aanname die bij grote bomen niet houdbaar is (paginatie/viewport-fetch nodig). |
| Privacy | Gemodelleerd, **niet afgedwongen**. `strictestVisibility()` bestaat maar wordt nog nergens toegepast. |
| CRUD / accounts / sharing | Niet gebouwd (buiten scope van deze sessie). |
| Modus-overgang | **Echte morph** (`src/ui/FamilyCanvas.tsx`): beide weergaven zijn één canvas; gedeelde nodes en relatielijnen veren tussen de twee layouts (de navigatie-layout wordt affien in de kunstwerk-ruimte geprojecteerd), view-exclusieve elementen faden. Pan/zoom werkt in beide modi en reset bij wisselen. |
| Navigatie bij grote families | Depth-terugval (2→1) boven 34 personen, compactere rijen met gestaggerde labels, schaal-ondergrens (58%) en pan/zoom als uitlaatklep. Werkt voor de Habsburg-extremen (16 kinderen), maar uitklappen/groeperen per tak blijft het structurele antwoord. |
| Mobiel | **Gevalideerd op device** (2026-06-13). Daarbij gevonden en gefixt: camera bleef niet op zoomniveau bij hernavigeren (nu: kunstwerk raakt camera niet aan, navigatie behoudt zoom en hercentreert vloeiend); Habsburg was onaanraakbaar (tikvlakken nu ≥ ~22 schermpixels i.p.v. canvas-eenheden, `clickDistance(12)` tegen d3's tik-onderdrukking, focusring met minimum-schermmaat). |
| Wikidata | Alleen biologische ouders (P22/P25); adoptie/stief zit wel in het model maar wordt niet uit Wikidata gehaald. Geen incrementele sync. |
| NL relatie-benoeming | **Gebouwd** (`src/domain/relationNaming.ts` + 13 unit-tests): kortste-pad-BFS, classificatie met half/stief/adoptie/aangetrouwd-nuance, pad-ondertitel tegen de neef/nicht-dubbelzinnigheid, "ook: …" bij meerdere even korte paden. Getoond in de persoonskaart t.o.v. de vaste "ik" per dataset. Resterende gaten: diepe aangetrouwde paden vallen terug op een generiek label + via-keten, en de benoeming is nog niet visibility-bewust. |

## Grootste risico's voor de volgende fase

1. **Privacy is een datalaag-probleem, geen UI-probleem.** Client-side filteren is geen beveiliging: afdwinging moet server-side in de repository gebeuren (de UI krijgt verborgen velden simpelweg nooit). Twee venijnige randgevallen die nu al in het ontwerp moeten meelopen: (a) verborgen personen die navigatiepaden breken — opgelost via anonieme silhouet-nodes die topologie bewaren (zie doc 01); (b) **afgeleide onthulling**: een zichtbare halfbroer impliceert een verborgen ouder. De afleidingsregels in `KinshipService` moeten dus óók visibility-bewust worden.
2. **Relatie-padberekening en NL-naamgeving.** Kortste-pad over de graph is technisch eenvoudig (BFS, prima tot ~10k personen), maar er zijn vaak meerdere paden (hertrouwen binnen familie — zie de Habsburgers) en het Nederlands is dubbelzinnig ("neef" = cousin én oomzegger). Het ontwerp — label + pad-ondertitel ("neef — zoon van je broer Jan") — staat in doc 01 en moet vroeg met gebruikers getoetst worden.
3. **Renderingsperformance bij groei.** SVG draagt 85 personen moeiteloos; bij 500+ wordt het op mobiel spannend. De vluchtroute is ingebouwd (layout-laag levert pure geometrie, renderer is vervangbaar door canvas), maar labels en semantische zoom moeten dan opnieuw ontworpen worden. Niet nu doen — wel de drempel bewaken.
4. **Layoutkwaliteit bij echte, rommelige data.** De barycentrische plaatsing geeft bij hertrouw-ketens soms lange huwelijksbogen en kruisingen (zichtbaar bij de Habsburgers — deels data-eerlijk, deels layoutbeperking). Opties: lokale optimalisatie-pass, of curated pinning voor de "muurprint"-use-case.
5. **Wereldbol-view.** Het model is er klaar voor (`Place` met lat/lon + wikidataId, `residences` als tijdreeks; Wikidata levert coördinaten al mee), maar de demo-familie heeft alleen handmatige coördinaten — geocoding van vrije-tekstplaatsen is nog een open stuk.
6. ~~Praktisch: Google Drive~~ — **opgelost**: project verhuisd naar `~/Documents/Projects/202606_FamilyTree` met GitHub (https://github.com/chieyong/familytree) als bron van waarheid.

## Voorgestelde volgorde volgende sessie

1. ~~NL relatie-benoeming~~ — **gedaan** (naar voren gehaald: hoogste toetsbare risico, bouwstenen lagen klaar; gevalideerd op de Habsburg-extremen zoals Maximiliaan II = schoonzoon én neef van Karel V).
2. Privacy-afdwinging in de repository-laag + silhouet-nodes — zodra de backend-fase start; de typed `strictestVisibility()`-regel ligt al vast.
3. Morph-overgang kunstwerk ⇄ navigatie (zelfde nodes, twee layouts — de architectuur is er al op voorbereid).
4. Device-validatie mobiel + pinch-gestures fijnslijpen.
