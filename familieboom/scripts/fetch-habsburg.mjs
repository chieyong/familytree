/**
 * Wikidata-loader: crawlt het Huis Habsburg rond Karel V (Q32500) via
 * vader/moeder/echtgenoot/kind-relaties en schrijft een FamilyGraph-JSON
 * naar src/data/fixtures/habsburg.json (cache, zodat de demo offline werkt).
 *
 * Alleen historische publieke figuren. Draaien: node scripts/fetch-habsburg.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const START = 'Q32500'; // Karel V, keizer van het Heilige Roomse Rijk
const MAX_DEPTH = 3;
const MAX_PERSONS = 85;
const API = 'https://www.wikidata.org/w/api.php';

const P = {
  father: 'P22',
  mother: 'P25',
  spouse: 'P26',
  child: 'P40',
  gender: 'P21',
  birth: 'P569',
  death: 'P570',
  birthPlace: 'P19',
  deathPlace: 'P20',
  coords: 'P625',
  start: 'P580',
  end: 'P582',
};

async function fetchEntities(ids) {
  const result = {};
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url = `${API}?action=wbgetentities&ids=${batch.join('|')}&props=claims|labels&languages=nl|en&format=json&origin=*`;
    const response = await fetch(url, { headers: { 'User-Agent': 'familieboom-poc/0.1 (educatief prototype)' } });
    if (!response.ok) throw new Error(`Wikidata ${response.status}`);
    const json = await response.json();
    Object.assign(result, json.entities ?? {});
    await new Promise((resolve) => setTimeout(resolve, 250)); // beleefd crawlen
  }
  return result;
}

const claimIds = (entity, prop) =>
  (entity.claims?.[prop] ?? [])
    .map((statement) => statement.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);

function fuzzyDate(timeValue) {
  if (!timeValue?.time) return undefined;
  const match = timeValue.time.match(/^([+-]\d+)-(\d\d)-(\d\d)/);
  if (!match) return undefined;
  const date = { year: Number(match[1]) };
  if (timeValue.precision >= 10 && Number(match[2]) > 0) date.month = Number(match[2]);
  if (timeValue.precision >= 11 && Number(match[3]) > 0) date.day = Number(match[3]);
  if (timeValue.precision <= 8) date.qualifier = 'approx';
  return date;
}

const firstDate = (entity, prop) =>
  fuzzyDate(entity.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value);

const label = (entity) =>
  entity.labels?.nl?.value ?? entity.labels?.en?.value ?? entity.id;

// --- BFS over de familierelaties -------------------------------------------
const depthOf = new Map([[START, 0]]);
const entities = {};
let frontier = [START];
while (frontier.length > 0 && depthOf.size <= MAX_PERSONS * 2) {
  const fetched = await fetchEntities(frontier.filter((id) => !entities[id]));
  Object.assign(entities, fetched);
  const next = [];
  for (const id of frontier) {
    const entity = entities[id];
    if (!entity) continue;
    const depth = depthOf.get(id) ?? 0;
    if (depth >= MAX_DEPTH) continue;
    for (const prop of [P.father, P.mother, P.spouse, P.child]) {
      for (const neighbor of claimIds(entity, prop)) {
        if (!depthOf.has(neighbor)) {
          depthOf.set(neighbor, depth + 1);
          next.push(neighbor);
        }
      }
    }
  }
  frontier = next;
}

// Cap: BFS-volgorde houdt de kern (Karel V + naaste familie) vast.
const kept = [...depthOf.entries()]
  .sort((a, b) => a[1] - b[1])
  .slice(0, MAX_PERSONS)
  .map(([id]) => id);
const keptSet = new Set(kept);
const missing = kept.filter((id) => !entities[id]);
Object.assign(entities, await fetchEntities(missing));

// --- Plaatsen (labels + coördinaten) ----------------------------------------
const placeIds = new Set();
for (const id of kept) {
  const entity = entities[id];
  if (!entity) continue;
  for (const prop of [P.birthPlace, P.deathPlace]) {
    for (const placeId of claimIds(entity, prop)) placeIds.add(placeId);
  }
}
const placeEntities = await fetchEntities([...placeIds]);
const placeOf = (entity, prop) => {
  const placeId = claimIds(entity, prop)[0];
  const place = placeId && placeEntities[placeId];
  if (!place) return undefined;
  const coords = place.claims?.[P.coords]?.[0]?.mainsnak?.datavalue?.value;
  return {
    name: label(place),
    ...(coords ? { lat: coords.latitude, lon: coords.longitude } : {}),
    wikidataId: placeId,
  };
};

// --- FamilyGraph opbouwen ----------------------------------------------------
const persons = [];
const parentLinks = [];
const unionByPair = new Map();
const deathYear = new Map();

for (const id of kept) {
  const entity = entities[id];
  if (!entity) continue;
  const gender = claimIds(entity, P.gender)[0];
  const birth = firstDate(entity, P.birth);
  const death = firstDate(entity, P.death);
  if (death) deathYear.set(id, death.year);
  persons.push({
    id,
    givenNames: [label(entity)],
    displayName: label(entity),
    sex: gender === 'Q6581097' ? 'm' : gender === 'Q6581072' ? 'f' : 'x',
    ...(birth || placeOf(entity, P.birthPlace)
      ? { birth: { ...(birth ? { date: birth } : {}), ...(placeOf(entity, P.birthPlace) ? { place: placeOf(entity, P.birthPlace) } : {}) } }
      : {}),
    ...(death || placeOf(entity, P.deathPlace)
      ? { death: { ...(death ? { date: death } : {}), ...(placeOf(entity, P.deathPlace) ? { place: placeOf(entity, P.deathPlace) } : {}) } }
      : {}),
    visibility: 'public',
    meta: { wikidataId: id },
  });
}

for (const id of kept) {
  const entity = entities[id];
  if (!entity) continue;
  // Vader eerst = naamgevende ouder (dynastieke lijn bepaalt de tak-kleur).
  for (const prop of [P.father, P.mother]) {
    for (const parent of claimIds(entity, prop)) {
      if (!keptSet.has(parent)) continue;
      parentLinks.push({
        id: `pl-${parent}-${id}`,
        parent,
        child: id,
        role: 'biological',
        visibility: 'public',
      });
    }
  }
  for (const statement of entity.claims?.[P.spouse] ?? []) {
    const partner = statement.mainsnak?.datavalue?.value?.id;
    if (!partner || !keptSet.has(partner)) continue;
    const key = [id, partner].sort().join('|');
    if (unionByPair.has(key)) continue;
    const qualifier = (prop) => fuzzyDate(statement.qualifiers?.[prop]?.[0]?.datavalue?.value);
    const start = qualifier(P.start);
    const end = qualifier(P.end);
    const endsByDeath =
      end && (deathYear.get(id) === end.year || deathYear.get(partner) === end.year);
    unionByPair.set(key, {
      id: `u-${key.replace('|', '-')}`,
      partners: [id, partner],
      type: 'marriage',
      ...(start ? { start } : {}),
      ...(end ? { end: { date: end, reason: endsByDeath ? 'death' : 'divorce' } } : {}),
      visibility: 'public',
    });
  }
}

const graph = { persons, unions: [...unionByPair.values()], parentLinks };
const out = join(dirname(fileURLToPath(import.meta.url)), '../src/data/fixtures/habsburg.json');
writeFileSync(out, JSON.stringify(graph, null, 2));
console.log(
  `Geschreven: ${persons.length} personen, ${graph.unions.length} verbintenissen, ${parentLinks.length} ouderlinks → ${out}`,
);
