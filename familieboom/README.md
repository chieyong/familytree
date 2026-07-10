# Familieboom — Bloom

Interactieve familieboom-webapp: een esthetische "Tableau"-view (levenslijnen op
een tijdas) en een ego-centrische "Boom"-navigatieweergave, op een graph-datamodel
dat complexe relaties aankan (scheiding, hertrouwen, half/stief, adoptie).

Live op **https://bloom.vizcraft.nl**. Meertalig (NL/EN/ZH/ID).

## Stack

Vite + React 18 + TypeScript (strict), Zustand, D3 (rekenlaag), Framer Motion.
Backend: **Supabase** (Postgres + RLS deny-by-default + Auth). Hosting via Netlify
(auto-deploy op `main`).

## Draaien

```bash
npm install
npm run dev
```

URL-parameters: `?backend=fixtures|supabase`, `?view=navigation|artwork`,
`?theme=light|dark`, `?lang=nl|en|zh|id`, `?data=habsburg`, `?tour=1`.

Tegen de echte database: `npm run dev` + `?backend=supabase` (env in `.env.local`:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BACKEND=supabase`).
Demo zonder DB: `?backend=fixtures`.

## Datasets (demo, fixtures)

- **Demo-familie**: fictief, bewust complex (`src/data/fixtures/demoFamily.ts`).
- **Habsburg**: 85 historische personen rond Karel V, uit Wikidata. Verversen:
  `node scripts/fetch-habsburg.mjs` (schrijft `src/data/fixtures/habsburg.json`).

## Functies (samengevat)

Eigen bomen aanmaken; personen + relaties toevoegen/bewerken (auto-opslaan);
profielfoto's; meerdere bijnamen per persoon; woonplaatsen (levensreis op de
Atlas); meertalige UI; per-persoon zichtbaarheid (familie/privé); uitnodigen met
rollen (**lezer, bijdrager, bewerker, beheerder**); een **bijdrager** stelt
wijzigingen voor die een owner/editor goedkeurt; bomen koppelen (bruggen) en
personen importeren uit een andere eigen boom.

**Gekoppelde bomen** — twee of meer gekoppelde families tegelijk tonen als één
samengevoegde boom (naadloos op de brugpersonen + naam/geboortejaar-identiteit),
met een kleuraccent per herkomst-familie.

**CSV-export/-import** — de actieve boom exporteren naar CSV (opent in Excel/Google
Sheets); bewerken en terug-importeren. Rijen met een `db_id` worden bijgewerkt,
nieuwe rijen (lege `db_id`) toegevoegd; plaatsnamen worden bij import gegeocodeerd.

## Architectuur

```
src/data/     datamodel + FamilyRepository (SupabaseRepository of FixtureRepository)
src/domain/   KinshipService: afgeleide verwantschap, zichtbaarheidsregels
src/layout/   pure functies: graph → geometrie (flowLayout, egoLayout)
src/ui/       React/SVG-views, thema (relatie-encoding), Zustand-store
supabase/migrations/  idempotente SQL, handmatig in de Supabase SQL-editor gedraaid
```

## Status & geschiedenis

- **`docs/STATUS.md`** — levende overdracht: migratie-overzicht, gebouwde features
  en openstaande punten. Begin hier voor een nieuwe sessie.
- Ontwerpdocumenten/beslisgeschiedenis: de map erboven
  (`01-stopmoment-1-datamodel-en-stack.md`, `02-stopmoment-2-visuele-richting.md`,
  `03-gap-analyse.md`, `04-backend-schema.md`).
