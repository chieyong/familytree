/**
 * Genereert supabase/seed.sql uit de bestaande fixtures (single source of truth).
 * Demo + Habsburg worden als twee publieke families geseed (etalage, zichtbaar
 * zonder login). Deterministische UUID's (sha1) → herhaald seeden is idempotent
 * via `on conflict (id) do nothing`.
 *
 *   npx tsx scripts/generate-seed.ts
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { demoFamily } from '../src/data/fixtures/demoFamily';
import type { FamilyGraph, FuzzyDate, Person } from '../src/data/types';

const here = dirname(fileURLToPath(import.meta.url));
const habsburg = JSON.parse(
  readFileSync(join(here, '../src/data/fixtures/habsburg.json'), 'utf8'),
) as FamilyGraph;

/** Stabiele, geldig-gevormde UUID v5-achtig uit een sleutel. */
function uuid(key: string): string {
  const h = createHash('sha1').update(`familieboom:${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const s = (v: string | undefined | null): string =>
  v == null ? 'null' : `'${v.replace(/'/g, "''")}'`;
const n = (v: number | undefined | null): string => (v == null ? 'null' : String(v));
const arr = (xs: string[]): string =>
  `array[${xs.map((x) => `'${x.replace(/'/g, "''")}'`).join(', ')}]::text[]`;

interface PlaceRow { id: string; name: string; lat?: number; lon?: number; wikidataId?: string }
const places = new Map<string, PlaceRow>();
function placeId(place?: { name: string; lat?: number; lon?: number; wikidataId?: string }): string | null {
  if (!place) return null;
  const key = place.wikidataId ?? `${place.name}|${place.lat ?? ''}|${place.lon ?? ''}`;
  const id = uuid(`place:${key}`);
  if (!places.has(id)) places.set(id, { id, ...place });
  return id;
}

const lines: string[] = [
  '-- Seed — gegenereerd door scripts/generate-seed.ts. Niet handmatig bewerken.',
  '-- Draai in de SQL-editor (als postgres → bypasst RLS). Idempotent.',
  '',
];

const families = [
  { key: 'demo', name: 'Demo-familie', graph: demoFamily },
  { key: 'habsburg', name: 'Habsburg', graph: habsburg },
];

const personRows: string[] = [];
const unionRows: string[] = [];
const plinkRows: string[] = [];
const familyRows: string[] = [];

for (const { key, name, graph } of families) {
  const fid = uuid(`family:${key}`);
  familyRows.push(`  ('${fid}', ${s(name)})`);
  const pid = (slug: string) => uuid(`${key}:person:${slug}`);
  const uid = (slug: string) => uuid(`${key}:union:${slug}`);

  for (const person of graph.persons as Person[]) {
    const b = person.birth?.date as FuzzyDate | undefined;
    const d = person.death?.date as FuzzyDate | undefined;
    personRows.push(
      `  ('${pid(person.id)}', '${fid}', ${arr(person.givenNames)}, ${s(person.familyName)}, ` +
        `${s(person.displayName)}, ${person.sex ? `'${person.sex}'` : 'null'}, ` +
        `${n(b?.year)}, ${n(b?.month)}, ${n(b?.day)}, ${b?.qualifier ? `'${b.qualifier}'` : 'null'}, ` +
        `${placeId(person.birth?.place) ? `'${placeId(person.birth?.place)}'` : 'null'}, ` +
        `${n(d?.year)}, ${n(d?.month)}, ${n(d?.day)}, ${d?.qualifier ? `'${d.qualifier}'` : 'null'}, ` +
        `${placeId(person.death?.place) ? `'${placeId(person.death?.place)}'` : 'null'}, ` +
        `'public', ${s(person.meta?.wikidataId)})`,
    );
  }

  for (const u of graph.unions) {
    const start = u.start as FuzzyDate | undefined;
    const end = u.end?.date as FuzzyDate | undefined;
    unionRows.push(
      `  ('${uid(u.id)}', '${fid}', '${pid(u.partners[0])}', '${pid(u.partners[1])}', '${u.type}', ` +
        `${n(start?.year)}, ${n(start?.month)}, ${n(start?.day)}, ` +
        `${n(end?.year)}, ${n(end?.month)}, ${n(end?.day)}, ${u.end?.reason ? `'${u.end.reason}'` : 'null'}, ` +
        `'public', 'public')`,
    );
  }

  for (const l of graph.parentLinks) {
    plinkRows.push(
      `  ('${uuid(`${key}:plink:${l.id}`)}', '${fid}', '${pid(l.parent)}', '${pid(l.child)}', '${l.role}', ` +
        `${l.unionId ? `'${uid(l.unionId)}'` : 'null'}, ${n((l.start as FuzzyDate | undefined)?.year)}, ` +
        `'public', 'public')`,
    );
  }
}

lines.push(
  'insert into families (id, name) values',
  familyRows.join(',\n') + '\non conflict (id) do nothing;\n',
);
lines.push(
  'insert into places (id, name, lat, lon, wikidata_id) values',
  [...places.values()]
    .map((p) => `  ('${p.id}', ${s(p.name)}, ${n(p.lat)}, ${n(p.lon)}, ${s(p.wikidataId)})`)
    .join(',\n') + '\non conflict (id) do nothing;\n',
);
lines.push(
  'insert into persons (id, family_id, given_names, family_name, display_name, sex,',
  '  birth_year, birth_month, birth_day, birth_precision, birth_place_id,',
  '  death_year, death_month, death_day, death_precision, death_place_id,',
  '  visibility, wikidata_id) values',
  personRows.join(',\n') + '\non conflict (id) do nothing;\n',
);
lines.push(
  'insert into unions (id, family_id, partner_a, partner_b, type,',
  '  start_year, start_month, start_day, end_year, end_month, end_day, end_reason,',
  '  existence_visibility, detail_visibility) values',
  unionRows.join(',\n') + '\non conflict (id) do nothing;\n',
);
lines.push(
  'insert into parent_links (id, family_id, parent_id, child_id, role, union_id, start_year,',
  '  existence_visibility, detail_visibility) values',
  plinkRows.join(',\n') + '\non conflict (id) do nothing;\n',
);

const out = join(here, '../supabase/seed.sql');
writeFileSync(out, lines.join('\n'));
console.log(
  `Seed geschreven: ${personRows.length} personen, ${unionRows.length} unions, ` +
    `${plinkRows.length} ouderlinks, ${places.size} plaatsen → ${out}`,
);
