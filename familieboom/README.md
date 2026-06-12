# Familieboom — proof-of-concept

Interactieve familieboom-webapp: een esthetische "kunstwerk"-view (levenslijnen
op een tijdas) en een ego-centrische navigatieweergave, op een graph-datamodel
dat complexe relaties aankan (scheiding, hertrouwen, half/stief, adoptie).

## Draaien

```bash
npm install
npm run dev
```

URL-parameters: `?view=navigation` (startweergave) en `?data=habsburg` (dataset).

## Datasets

- **Demo-familie**: fictief, bewust complex (`src/data/fixtures/demoFamily.ts`).
- **Habsburg**: 85 historische personen rond Karel V, uit Wikidata. Verversen:
  `node scripts/fetch-habsburg.mjs` (schrijft `src/data/fixtures/habsburg.json`).

## Architectuur

```
src/data/     datamodel + FamilyRepository (async interface, nu fixtures)
src/domain/   KinshipService: afgeleide verwantschap, zichtbaarheidsregels
src/layout/   pure functies: graph → geometrie (flowLayout, egoLayout)
src/ui/       React/SVG-views, thema (relatie-encoding), Zustand-store
```

Ontwerpdocumenten en beslisgeschiedenis: zie de map erboven
(`01-stopmoment-1-datamodel-en-stack.md`, `02-stopmoment-2-visuele-richting.md`,
`03-gap-analyse.md`).
