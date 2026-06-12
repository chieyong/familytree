# Stop-moment 1 — Datamodel & Stack

> Status: **wacht op akkoord** voordat er gebouwd wordt.

---

## 1. Datamodel

### Kernbeslissing: graph met twee soorten relatie-objecten

Het model is een gerichte graph met drie entiteiten: `Person`, `Union` (partnerschap) en `ParentChildLink` (ouder–kind). Relaties zijn eersteklas objecten met een eigen `id`, `type`, tijdsdimensie en zichtbaarheidsvlag.

De belangrijkste ontwerpkeuze: **ouder–kind-relaties worden per ouder vastgelegd, niet per ouderpaar.** Dat klinkt klein, maar het is wat alle "moeilijke" gevallen oplost:

- **Half-broers/-zussen** ontstaan vanzelf: twee kinderen die precies één biologische ouder delen. Niets extra's te modelleren.
- **Meerdere ouderparen** (biologisch, stief, adoptie): gewoon meerdere `ParentChildLink`s met verschillende `role`.
- **Stieffamilie** is afleidbaar: partner van je ouder via een `Union` die níet jouw biologische ouder is.
- **Broer/zus wordt nooit opgeslagen** — altijd afgeleid. Opgeslagen siblings raken onvermijdelijk inconsistent met de ouderlinks; afgeleide niet.

```ts
type PersonID = string;
type Visibility = 'public' | 'family' | 'private';

/** Datums met onzekerheid — essentieel voor historische data (Wikidata) */
interface FuzzyDate {
  year: number;
  month?: number;
  day?: number;
  qualifier?: 'exact' | 'approx' | 'before' | 'after';
}

/** Gestructureerde plaats — voorbereid op de wereldbol-view */
interface Place {
  name: string;
  lat?: number;
  lon?: number;
  wikidataId?: string;
}

interface Person {
  id: PersonID;
  givenNames: string[];
  familyName?: string;
  displayName?: string;          // override, bijv. "Willem van Oranje"
  sex?: 'm' | 'f' | 'x';
  birth?: { date?: FuzzyDate; place?: Place };
  death?: { date?: FuzzyDate; place?: Place };
  residences: { place: Place; from?: FuzzyDate; to?: FuzzyDate }[];
  visibility: Visibility;        // default voor de hele persoon
  fieldVisibility?: Record<string, Visibility>;  // per-veld override
  meta?: { wikidataId?: string; notes?: string };
}

/** Partnerschap — eersteklas object met begin én einde */
interface Union {
  id: string;
  partners: [PersonID, PersonID];
  type: 'marriage' | 'registered' | 'cohabitation' | 'relationship';
  start?: FuzzyDate;
  end?: { date?: FuzzyDate; reason: 'divorce' | 'separation' | 'death' };
  visibility: Visibility;
}

/** Ouder–kind, per ouder — dít is het fundament */
interface ParentChildLink {
  id: string;
  parent: PersonID;
  child: PersonID;
  role: 'biological' | 'adoptive' | 'step' | 'foster';
  unionId?: string;   // optioneel: binnen welke verbintenis
  start?: FuzzyDate;  // bijv. adoptiedatum
  visibility: Visibility;
}

interface FamilyGraph {
  persons: Person[];
  unions: Union[];
  parentLinks: ParentChildLink[];
}
```

### Hoe dit de complexe gevallen uit de opdracht dekt

| Geval | Modellering |
|---|---|
| Scheiding + hertrouwen | Twee `Union`s voor dezelfde persoon; de eerste heeft `end.reason: 'divorce'` |
| Ex-partner | `Union` met `end` — relatie blijft bestaan in de graph, krijgt eigen visuele encoding |
| Half-broer/-zus | Afgeleid: precies één gedeelde biologische ouder |
| Stiefouder | Afgeleid: partner (`Union`) van ouder zonder eigen `ParentChildLink`, óf expliciet met `role: 'step'` als de band sterk is |
| Adoptie naast bio-ouders | Meerdere `ParentChildLink`s per kind met verschillende `role` |
| Tijdsdimensie | `FuzzyDate` overal; relaties hebben start/eind |
| Privacy (later) | `visibility` op persoon, per veld, én per relatie — nu gemodelleerd, nog niet afgedwongen |
| Wereldbol (later) | `Place` heeft lat/lon + wikidataId; `residences` is al een tijdreeks |

Alle afgeleide verwantschap (broer, half-zus, stiefvader, oudtante, "neef") leeft in één **`KinshipService`** — pure functies over de graph. Dat is straks ook de plek voor de Nederlandse relatie-benoeming (zie §4).

### Datalaag

```ts
interface FamilyRepository {
  getPerson(id: PersonID): Promise<Person | undefined>;
  getEgoGraph(id: PersonID, depth: number): Promise<FamilyGraph>; // navigatieweergave
  getFullGraph(): Promise<FamilyGraph>;                           // kunstwerk-view
  search(query: string): Promise<Person[]>;
}
```

Twee implementaties in deze sessie:

1. **`FixtureRepository`** — fictieve familie uit een JSON-bestand (3+ generaties, scheiding, hertrouwing, halfsiblings, stiefouder).
2. **`WikidataRepository`** — laadt een historisch vorstenhuis (voorstel: **Huis Habsburg rond Karel V** of **Britse royals t/m George VI** — beide vol hertrouwingen en half-verwanten, allemaal overleden). De loader haalt eenmalig op via SPARQL en cachet naar JSON, zodat de demo offline werkt.

Alles is `async` vanaf dag één — de latere API-swap is dan letterlijk één class vervangen. **Geen mock-data in componenten**; de visualisatie kent alleen `FamilyGraph`.

---

## 2. Stackadvies

**Advies: blijf bij React + D3, maar met een strikte rolverdeling — en TypeScript is niet optioneel.**

| Keuze | Wat | Waarom |
|---|---|---|
| Build | **Vite + React 18 + TypeScript** | Geen SSR-behoefte, statisch deploybaar (past bij je mijn.host-pipeline). TS omdat het graph-model met al die afgeleide relaties anders stilletjes kapotgaat. |
| Rendering | **React rendert SVG; D3 alleen als rekenbibliotheek** | Eén DOM-eigenaar. D3 levert `d3-shape` (organische curven), `d3-scale`/`d3-scale-chromatic`, `d3-zoom`, evt. `d3-force`. Geen `selection.join` naast React. |
| Camera | **d3-zoom met semantische zoom (LOD-drempels)** | Vloeiend pannen/zoomen op mobiel is precies waar d3-zoom goed in is; op zoomniveau schakelen tussen "wirwar" en detail. |
| Animatie | **Framer Motion voor UI + enter/exit; d3-interpolate voor path-morphs** | De ego-recentrering is in essentie één camera-animatie (d3-zoom transform) plus path-morphs — dat wil je niet door een component-animatielibrary laten doen. |
| State | **Zustand** | Werkt ook búiten de React-tree (handig in d3-zoom-callbacks), geen boilerplate. |

**Waarom geen alternatieven:**

- **Canvas/WebGL (PixiJS):** op PoC-schaal (50–300 personen) onnodig, en je verliest de editoriale SVG-toolbox (gradients, filters, typografie op paden) die juist het "kunstwerk"-gevoel maakt. Wel houden we de vluchtroute open: de layout-laag produceert pure geometrie-data, los van de renderer. Als het ooit duizenden nodes worden, is alleen de render-laag te vervangen.
- **Cytoscape / react-flow / vis.js:** generieke node-link-esthetiek — expliciet wat de opdracht níet wil.
- **Svelte:** prima voor viz, maar levert hier niets op tegenover jouw bestaande React-expertise.

**Architectuur in lagen:**

```
data/        FamilyRepository + Fixture- en Wikidata-implementaties
domain/      KinshipService, graph-traversal, relatie-benoeming
layout/      pure functies: FamilyGraph + focuspersoon → geometrie
             (posities, paden, LOD-niveaus) — géén React, géén DOM
ui/          React-componenten: viewport, nodes, links, toggle
             kunstwerk ⇄ navigatie, persoonskaart
```

De layout-laag als pure functie is de belangrijkste architecturale zet: hij maakt de twee views (kunstwerk vs. navigatie) twee *layouts op dezelfde graph* in plaats van twee aparte apps, en hij is testbaar zonder browser.

---

## 3. Input op open vraag: privacysysteem (later)

- **Zichtbaarheid als drie niveaus** (`public` / `family` / `private`) op persoon, veld én relatie — zit al in het model hierboven.
- **Verborgen personen breken geen paden:** render ze als anonieme silhouet-node ("verborgen persoon") die de topologie intact houdt. Je ziet dát er iemand is, niet wíe. Alleen als iemand én al zijn relaties `private` zijn, verdwijnt de node — en accepteer je dat een tak onbereikbaar wordt.
- **Gedeeld eigenaarschap:** leg per persoon een `managedBy` vast. Het feit dat A met B getrouwd was is van beiden; hanteer daarom voor relaties de strengste zichtbaarheid van de twee betrokkenen.
- **Afdwingen in de datalaag**, nooit in de UI: de repository levert al gefilterde/geanonimiseerde graphs, zodat verborgen data het component nooit bereikt.

## 4. Input op open vraag: relaties benoemen in het Nederlands

- Bereken het **kortste pad** via ouder/kind/partner-edges, classificeer als (stappen omhoog, stappen omlaag, partner-sprongen) en map dat op Nederlandse termen.
- **"Neef/nicht" is in het Nederlands dubbelzinnig** (oomzegger vs. cousin). Toon daarom altijd het pad als ondertitel: *"neef — zoon van je broer Jan"*. Dat lost ook aangetrouwd/half/stief-nuance op zonder gedrochten als "aangetrouwde halfoudtante".
- **Meerdere paden** (bij hertrouwen binnen de familie of verre verwantschap): toon het kortste/bloedverwante pad als label, met "ook: …" voor de rest.

---

## Bij akkoord bouw ik richting Stop-moment 2

Een lo-fi gestyled prototype van beide views (kunstwerk + ego-navigatie) op de fictieve familie, zodat we de esthetische richting kunnen ijken vóór de volledige build.

**Beslispunten voor jou:**
1. Akkoord op het datamodel (m.n. per-ouder `ParentChildLink` + afgeleide siblings)?
2. Akkoord op de stack (Vite/React/TS, D3 als rekenlaag, Zustand, Framer Motion)?
3. Voorkeur voor het Wikidata-vorstenhuis: Habsburg (Karel V) of Brits (t/m George VI)?
