# Bouwopdracht: Interactieve Familieboom — Visuele Proof-of-Concept

> Plak deze prompt in Claude Code met Fable geselecteerd (`/model fable`).
> Deze sessie bouwt **alleen** de visuele kern. CRUD, accounts en sharing volgen later.

---

## Rol & werkwijze

Je bouwt de eerste, visueel sterke proof-of-concept van een interactieve familieboom-webapp. Werk **plan-eerst**: bouw nog niets totdat ik twee beslispunten heb goedgekeurd (zie "Stop-momenten" onderaan). Onderzoek waar nodig, wees eerlijk over trade-offs, en lever aan het eind een eerlijke gap-analyse.

De maker is een ervaren data-visualisatie-specialist (D3.js, React). Je hoeft basisbegrippen niet uit te leggen, maar motiveer architectuur- en designkeuzes wel expliciet.

---

## Scope van DEZE sessie (bewust afgebakend)

**WEL bouwen:**
1. Een robuust **datamodel** dat complexe familierelaties aankan (zie hieronder).
2. De **"kunstwerk"-view**: volledig uitgezoomd toont de boom een organisch, esthetisch geheel — iets dat je als infographic aan de muur zou hangen. Inspiratie: Federica Fragapane en Nadieh Bremer. Betekenisvolle visuele encoding (vorm/kleur/positie dragen data).
3. **Ego-centrische navigatie**: de gebruiker staat centraal als startpunt; van daaruit navigeer je vloeiend naar andere personen, die dan het nieuwe middelpunt worden.
4. **Zoom in/uit** met vloeiende animaties, waarbij detail verschijnt bij inzoomen en de esthetische "wirwar" zichtbaar wordt bij uitzoomen.
5. **Relatie-encoding**: visueel onderscheid (vorm, lijnstijl, kleur) tussen relatietypen — ouder/kind, broer/zus, half-broer/-zus, stief, partner, ex-partner, hertrouwd, etc.
6. **Mobile-first**, met een ruimere desktop-variant die meer in één oogopslag toont.

**NIET bouwen deze sessie** (wel het ontwerp erop voorbereiden):
- Data-entry / CRUD-modules
- Accounts, login, sharing
- Echte backend
- De wereldbol-view (komt later — houd het datamodel er wel geschikt voor)
- Privacy-permissiesysteem (alleen het datamodel moet het later kunnen dragen)

---

## Architectuureisen

- **Backend-ready, lokaal startend.** Strikte scheiding tussen datalaag en UI. Alle data komt via een data-interface (repository/service-laag) die nu een lokale mock-implementatie heeft, maar later naadloos door een echte API vervangen kan worden. **Bak geen mock-data in de visualisatiecomponenten.**
- **Datamodel als graph, niet als boom.** Relaties zijn eersteklas objecten met een `type` en een tijdsdimensie (een huwelijk/partnerschap heeft een begin en soms een eind). Een persoon kan meerdere ouderparen hebben (biologisch, stief, adoptie). Ontwerp dit zorgvuldig — dit is het fundament waar alles op rust.
- Houd in het model alvast ruimte voor: geboorte-/sterfdatum, geboorteplaats, woonplaats(en) over tijd, sterftelocatie, en een per-persoon/per-veld **zichtbaarheidsvlag** (voor het latere privacysysteem — nu nog niet afdwingen, wel modelleren).

---

## Demo-data

- Genereer een **fictieve familie** met bewust complexe structuur: minstens één scheiding + hertrouwing, half-broers/-zussen, een stiefouder, en 3+ generaties. Dit stress-test de relatie-encoding.
- Bereid daarnaast een **Wikidata-loader** voor historische/royal figuren voor (bijv. een Europees vorstenhuis). Royals bevatten van nature scheidingen, hertrouwingen en half-verwanten — ideale realistische testdata. Gebruik **alleen historische/publieke figuren**, geen levende privépersonen.

---

## Designrichting

- Mobile-first; vloeiende animaties zijn een kerneis, geen bijzaak.
- Accepteer expliciet dat de **"kunstwerk"-view een aparte modus** is, los van de heldere navigatieweergave — die twee hebben tegenstrijdige behoeften (rust/hiërarchie vs. betekenisvolle dichtheid). Ontwerp een nette toggle/overgang ertussen.
- Streef naar de esthetische lat van de Information is Beautiful Awards: organische curven, data-gedreven kleur, atmosfeer, editoriale afwerking. Geen generieke node-link-graaf.

---

## Stop-momenten (plan-eerst, niet doorbouwen)

**Stop-moment 1 — Datamodel & stack.** Presenteer eerst:
- Je voorgestelde **datamodel** (entiteiten, relatie-objecten, tijdsdimensie) met een korte motivatie waarom het de genoemde complexe relaties aankan.
- Je **stackadvies** met motivatie (de maker werkt met React + D3.js; adviseer of dat hier optimaal is of dat iets anders beter past, en waarom).
Wacht op mijn akkoord.

**Stop-moment 2 — Visuele richting.** Voordat je de volledige view bouwt: lever een **lo-fi schets of klein gestyled prototype** van de "kunstwerk"-view én de navigatieweergave, zodat we de esthetische richting kunnen ijken. Wacht op mijn akkoord.

Daarna: bouw de proof-of-concept, en sluit af met een **eerlijke gap-analyse** (wat werkt, wat is nog mock, wat zijn de grootste risico's voor de volgende fase — met name privacy en relatie-padberekening).

---

## Open vragen waar ik je input op waardeer

- Hoe zou jij het latere **privacysysteem** modelleren, gegeven dat familiedata gedeeld eigendom is en dat verborgen personen navigatiepaden kunnen breken?
- Hoe benoem je relaties tussen twee willekeurige personen in het Nederlands op een begrijpelijke manier (er kunnen meerdere paden zijn)?
