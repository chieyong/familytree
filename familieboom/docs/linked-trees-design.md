# Ontwerp — Gekoppelde bomen met poortwachter ("bruggen")

Status: **voorstel** (nog niet gebouwd). Doel van dit document: het datamodel,
de rechten (RLS) en de navigatie-/toestemmingsflow vastleggen vóórdat we bouwen.

## 1. Wat we willen

Meerdere onafhankelijke familiebomen (elk een eigen `families`-rij, eigen
eigenaarschap en RLS) kunnen verbonden worden **bij een huwelijk**. Vanuit jouw
boom kun je via een paar "doorlopen" naar de boom van de aangetrouwde familie —
maar de grens over vereist **toestemming van die andere familie** (de
poortwachter), en die toegang is begrensd en intrekbaar.

Kernprincipe dat behouden blijft: **elke familie bezit en bewaakt haar eigen
data.** Een brug is *ontdekking + een snelle weg om toegang te vragen*, geen
achterdeur.

## 2. Kernkeuze: hoe ziet de brug eruit?

Twee mogelijke modellen:

- **(A) Spiegel-knoop + identiteitskoppeling** — Weiyie bestaat als knoop in
  *beide* bomen (Lai én Man), elk met eigen foto/privacy. Een `tree_link` zegt:
  "deze Weiyie = die Weiyie". Navigatie steekt over via die koppeling.
- **(B) Huwelijk over de grens** — één `union` verbindt een persoon in Lai
  direct met een persoon in Man. Geen dubbele Weiyie, maar het breekt de huidige
  regel dat beide partners in een union dezelfde `family_id` hebben, en
  bemoeilijkt "van wie is deze relatie / wie mag 'm bewerken".

**Aanbeveling: (A) spiegel-knoop.** Elke familie houdt haar eigen knoop en data;
de koppeling is licht en symmetrisch. Past het best bij "elke familie eigen
zeggenschap".

## 3. Datamodel (toevoeging)

```sql
create table tree_links (
  id          uuid primary key default gen_random_uuid(),
  -- de twee spiegel-personen die de brug vormen
  family_a    uuid not null references families on delete cascade,  -- bv. Lai
  person_a    uuid not null references persons  on delete cascade,  -- Weiyie-in-Lai
  family_b    uuid not null references families on delete cascade,  -- Man
  person_b    uuid not null references persons  on delete cascade,  -- Weiyie-in-Man
  status      text not null default 'proposed', -- 'proposed' | 'active'
  proposed_by uuid references profiles,
  created_at  timestamptz not null default now()
);
```

- Een brug wordt **voorgesteld** door de owner van de ene boom en wordt **actief**
  zodra de owner van de andere boom akkoord is. Tweezijdige toestemming om de
  brug überhaupt te leggen.
- De daadwerkelijke *toegang* om de andere boom te bekijken loopt via de
  **bestaande** `family_members` (pending → active via goedkeuring). De brug
  maakt dat verzoek alleen contextueel ("vraag toegang") en toont de "hier zit
  meer familie"-markering.

### Bootstrap: hoe verwijs je naar een boom waar je nog geen toegang toe hebt?

Een **koppel-code** (zoals de uitnodigingstoken, maar familie↔familie):

1. Owner van Man genereert een koppel-code voor een specifieke persoon
   (Weiyie-in-Man).
2. Owner van Lai plakt die code op Weiyie-in-Lai → stelt de brug voor.
3. Owner van Man bevestigt → brug wordt `active`.

Zo is er geen vooraf-toegang nodig om de koppeling te leggen.

## 4. Navigatie- en toestemmingsflow

1. Een persoon die een brug ís (actieve `tree_link`) krijgt een markering:
   **"↗ ook in familie Man"**.
2. Klik erop:
   - **Heb je al (goedgekeurde) toegang tot Man** → wissel context naar Man,
     gefocust op de spiegel-persoon. Een kruimelpad om terug te springen.
   - **Nog geen toegang** → "Vraag toegang tot familie Man" → maakt een
     *pending* lidmaatschap in Man → de owner van Man ziet dat onder
     **Delen → Leden** (de poortwachter) en keurt goed of af.
3. **Intrekken:** owner van Man verwijdert je lidmaatschap (bestaat al) → je kunt
   niet meer oversteken. De brug-markering blijft, maar valt terug op "vraag
   toegang".

De poortwachter is dus exact het bestaande uitnodigen → in-afwachting →
goedkeuren-mechanisme, nu aangeroepen vanuit een knoop in plaats van een losse
link.

## 5. Toegang: hoe breed?

- **v1 — vol lezer-lidmaatschap** van de andere boom (via de bestaande
  goedkeuring). Let op: "vol" betekent *wat familie-zichtbaar is in die boom* —
  per-persoon `visibility` blijft maskeren. Leunt volledig op bestaande privacy.
- **v2 — begrensd kijkje**: alleen de lijn vanaf de brug-persoon naar buiten
  (haar bloedlijn), de rest blijft verborgen. Mooier, maar vraagt een aparte
  scoped-graph-RPC.

**Aanbeveling: v1 nu, v2 later.**

## 6. Rechten (RLS), kort

- `tree_links`: zichtbaar voor leden van beide families; **voorstellen** vereist
  owner van de voorstellende kant; **activeren** vereist owner van de andere kant.
- Oversteken geeft **geen** automatische datatoegang — data blijft gegated door
  lidmaatschap + per-persoon zichtbaarheid in de doelboom.
- Hiermee blijft "elke familie bezit en bewaakt haar eigen data" volledig intact.

## 7. Hergebruiken vs. bouwen

**Hergebruik:** `families`, `family_members` (pending/active + goedkeuren = de
poortwachter), lid-verwijderen (intrekken), RLS-helpers, de graaf-RPC's.

**Bouwen:**
- `tree_links`-tabel + RLS.
- Koppel-code-flow (voorstellen/accepteren tussen twee owners).
- "Vraag toegang + oversteken"-actie en de brug-markering op de knoop.
- Context-wissel met kruimelpad terug.
- Melding voor de owner bij een binnengekomen toegangsverzoek.

## 8. Fasering

- **Fase 1 (MVP):** spiegel-brug + koppel-code + brug-markering + "vraag toegang"
  (maakt pending lidmaatschap) + oversteken zodra goedgekeurd. Leunt volledig op
  bestaand lidmaatschap/zichtbaarheid voor de poortwachter.
- **Fase 2:** begrensd/alleen-lezen oversteken, één doorlopend beeld met
  kruimelpad, brug intrekken in de UI, "dezelfde persoon"-profielsync.

## 9. Vastgelegde beslissingen

1. **Brugmodel:** spiegel-knoop — elke familie houdt haar eigen knoop + data, een
   koppeling zegt "dezelfde persoon". ✅
2. **Toegangsbreedte bij oversteken:** vol lezer-lidmaatschap (v1); per-persoon
   zichtbaarheid blijft maskeren. Begrensd kijkje is v2. ✅
3. **Wie mag bruggen leggen:** alleen owners (voorstellen én accepteren). ✅
4. **Bootstrap:** koppel-code-handdruk tussen de twee owners. ✅

## 10. Bouwplan — fase 1 (MVP)

### 10.1 Database (migratie)
- `bridge_invites(token uuid, family_b uuid, person_b uuid, created_by, created_at)`
  — een koppel-code die de owner van Man maakt voor één persoon (Weiyie-in-Man).
- `tree_links(family_a, person_a, family_b, person_b, created_by, created_at)`
  — de actieve brug (symmetrisch).
- RPC's (SECURITY DEFINER, owner-checks):
  - `create_bridge_invite(p_family, p_person) → token` (owner van die boom).
  - `accept_bridge_invite(p_token, p_family_a, p_person_a)` → maakt de `tree_link`
    meteen actief (beide owners hebben gehandeld = tweezijdige toestemming).
  - `request_family_access(p_family)` → zet een *pending* `family_members`-rij voor
    de huidige gebruiker, mits er een actieve brug bestaat tussen `p_family` en een
    familie waar de gebruiker lid van is (geen toegang tot willekeurige bomen).
- RLS: `tree_links` zichtbaar voor leden van beide families; muteren via de RPC's.
- `_build_graph`: per zichtbare persoon een `bridge`-veld toevoegen (de andere
  kant: `familyId`, `familyName`, `personId`) als er een actieve `tree_link` op
  die persoon zit.

### 10.2 Datalaag (frontend)
- `bridges.ts`: `createBridgeInvite`, `acceptBridgeInvite`, `requestFamilyAccess`.
- `types.ts`: `Person.bridge?: { familyId; familyName; personId }`.

### 10.3 UI
- **Brug leggen** (owner): in `PersonPanel` een sectie "Koppel aan andere familie"
  → genereer code (deelbaar) / plak code om te accepteren.
- **Brug-markering**: op de knoop + in de persoonskaart een "↗ ook in familie X".
- **Oversteken**: klik op de markering →
  - lid van X? → `setActiveFamily(X, ego=person_b)` + kruimelpad terug.
  - geen lid? → `request_family_access` → melding "verzoek verstuurd"; owner van X
    keurt goed via het bestaande Delen → Leden.
- **Kruimelpad**: store onthoudt de vorige familie → knop "← terug naar Lai".

### 10.4 Hergebruik (niets nieuws nodig)
Goedkeuren/afwijzen van het toegangsverzoek, intrekken (lid verwijderen), en alle
zichtbaarheids-maskering: bestaat al.

### 10.5 Bewust buiten fase 1
Begrensd alleen-lezen oversteken (v2), één doorlopend gestikt beeld, brug
intrekken in de UI, profielsync tussen de twee spiegel-knopen.
