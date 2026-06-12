# Stop-moment 2 — Visuele richting (gestyled prototype)

> Status: **akkoord** (2026-06-12, na vervanging van de spiraal door de levenslijnen-tijdstroom). De volledige PoC is daarna gebouwd — zie `03-gap-analyse.md` voor de eindstand.

## Bekijken

```bash
cd familieboom && npm run dev
```

- Kunstwerk-view: `http://localhost:5173/`
- Navigatie-view: `http://localhost:5173/?view=navigation` (of via de toggle rechtsboven)
- Screenshots: zie `screenshots/`

## Wat dit prototype al doet

- **Kunstwerk-view "levenslijnen"** (v2, na feedback op de eerdere spiraal): verticale tijdas — geboortejaar bepaalt de positie, dus de compositie dráágt data. Elke persoon is een levenslijn van geboorte tot overlijden (levenden lopen vager door tot nu); kinderen ontspringen aan de levenslijn van hun ouder op het geboortemoment; huwelijken verbinden twee levenslijnen in het huwelijksjaar; hertrouwingen tonen zich als langere bruggen tussen takken. Decennia staan als stille horizonlijnen in de achtergrond. Pan/zoom via d3-zoom; bij inzoomen verschijnen namen en jaartallen (semantische zoom). Op mobiel scroll je verticaal door de tijd — de as past van nature bij portrait.
- **Navigatie-view**: focuspersoon (nu: Lisa) gegarandeerd én continu exact in het midden — de layout is symmetrisch rond de ego en de camera staat vast op dat middelpunt; alleen de schaal veert mee bij hernavigeren. Generaties als rustige rijen, barycentrisch geordend; tik op een persoon → die veert naar het middelpunt (Framer Motion springs).
- **Relatie-encoding** (gedeeld door beide views, één bron van waarheid in `ui/theme.ts`):
  - kleur = stamtak · nodegrootte = aantal nakomelingen · open node = overleden
  - effen lijn = biologisch ouder–kind · stippellijn = adoptie · streepjes = stief
  - warm-witte lijn = partnerschap (dun gestippeld = samenwonend) · vervaagd gestreept = gescheiden
- De demo-familie stress-test alles: scheiding + hertrouwing (Willem; Anna), halfsiblings (Marco; Femke), stiefvader (Tom), adoptie (Tom → Daan).

## Te ijken (jouw feedback)

1. ~~Atmosfeer~~ → **akkoord**: donker editoriaal blijft.
2. ~~Spiraal~~ → **vervangen** door de levenslijnen-tijdstroom na feedback (functioneel zwak: radiaal lezen, geen betekenisvolle as).
3. **Levenslijnen-compositie**: draagt de tijdas-metafoor voor jou? Met name de aftak-curves (kind ontspringt aan ouderlijn) en de huwelijksbogen wil ik geijkt hebben vóór de Habsburg-dichtheid erbij komt.
4. **Dichtheid**: nu ~21 personen. Met de Habsburg-set (~60–100) wordt het voller; dat verifieer ik met echte data in de volgende fase.
5. **Navigatie-diepte**: de ego-view toont nu 2 stappen (Sophie, stiefzus via Tom, valt daar net buiten — je bereikt haar via Tom). Dieper tonen = drukker.

## Bekende prototype-grenzen (bewust)

- Mobiele screenshots via headless Chrome flatteren niet (geen viewport-emulatie); op een echte telefoon grijpen de mobile-first media queries wél.
- De kunstwerk→navigatie-overgang is nu een harde wissel; de vloeiende morph tussen beide layouts is onderdeel van de volledige PoC-bouw.
- Wikidata-loader (Habsburg/Karel V) staat klaar als ontwerp, nog niet gebouwd — volgt na dit akkoord.

## Na akkoord bouw ik de volledige PoC

Habsburg-loader met cache, ego-recentrering ín de kunstwerk-view, overgangsanimatie tussen de twee modi, mobiele fijnslijperij, en de afsluitende eerlijke gap-analyse (privacy, relatie-padberekening, performance).
