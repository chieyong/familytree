import { geoCentroid, geoDistance } from 'd3-geo';
import type { FamilyGraph, Person, PersonID, Place } from '../data/types';

/**
 * Reken-laag voor de wereldbol-view: vertaalt de familiegraaf naar geografische
 * primitieven (punten + bogen) in [lon, lat]. Hier zit géén projectie of
 * schermgeometrie — dat doet GlobeCanvas, zodat draaien/zoomen los staat van wat
 * er getekend wordt (zoals flowLayout/egoLayout dat voor de boom doen).
 */

const CURRENT_YEAR = 2026;

export interface GlobePoint {
  id: PersonID;
  person: Person;
  /** [lon, lat] — al licht "uitgewaaierd" zodat personen uit dezelfde stad niet samenvallen. */
  coord: [number, number];
  branch: number;
  deceased: boolean;
}

export interface GlobeArc {
  id: string;
  from: [number, number];
  to: [number, number];
  branch: number;
  /** Bron-persoon (ouder, resp. de persoon zelf) — voor highlight rond de selectie. */
  sourceId: PersonID;
  /** Doel-persoon (kind, resp. de overledene) — voor selectie/highlight. */
  targetId: PersonID;
}

export type LifeStopKind = 'birth' | 'residence' | 'death';

export interface LifeStop {
  coord: [number, number];
  kind: LifeStopKind;
}

/** Het geografische levenspad van één persoon: geboorte → woonplaatsen → overlijden. */
export interface LifePath {
  id: string;
  personId: PersonID;
  branch: number;
  /** Chronologisch geordende haltes (≥ 2), opeenvolgende duplicaten verwijderd. */
  stops: LifeStop[];
}

export interface GlobeData {
  points: GlobePoint[];
  /** Geboorteplaats ouder → geboorteplaats kind (familie verspreidt zich). */
  migration: GlobeArc[];
  /** Levenspad per persoon: geboorte → woonplaatsen → overlijden. */
  lifePaths: LifePath[];
  /** Zwaartepunt [lon, lat] van alle geboorteplaatsen — de begin-oriëntatie van de bol. */
  center: [number, number];
  /** Grootste hoekafstand (radialen) van een punt tot het zwaartepunt — voor auto-fit zoom. */
  spread: number;
}

const placeCoord = (pl?: Place): [number, number] | null =>
  pl && pl.lat != null && pl.lon != null ? [pl.lon, pl.lat] : null;

const birthCoord = (p?: Person): [number, number] | null => placeCoord(p?.birth?.place);
const deathCoord = (p?: Person): [number, number] | null => placeCoord(p?.death?.place);

const isDeceased = (person: Person): boolean => {
  if (person.death !== undefined) return true;
  const year = person.birth?.date?.year;
  return year === undefined || year + 100 < CURRENT_YEAR;
};

const same = (a: [number, number], b: [number, number]): boolean =>
  Math.abs(a[0] - b[0]) < 1e-4 && Math.abs(a[1] - b[1]) < 1e-4;

/**
 * Personen uit dezelfde stad waaieren uit langs een gulden-hoek-spiraal. De
 * offset is in graden, dus hij schaalt mee met de zoom: op wereldniveau vallen
 * ze samen, ingezoomd op een land worden het losse stippen.
 */
const JITTER_DEG = 0.22;
const GOLDEN = 2.399963229728653;

export function globeData(graph: FamilyGraph, branches?: Map<PersonID, number>): GlobeData {
  const branchOf = (id: PersonID) => branches?.get(id) ?? 0;
  const byId = new Map(graph.persons.map((p) => [p.id, p]));

  // Punten met uitwaaiering per gedeelde stad.
  const seen = new Map<string, number>();
  const points: GlobePoint[] = [];
  for (const person of graph.persons) {
    const base = birthCoord(person);
    if (!base) continue;
    const key = `${base[0].toFixed(2)},${base[1].toFixed(2)}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    let coord = base;
    if (n > 0) {
      const radius = JITTER_DEG * Math.sqrt(n);
      const angle = n * GOLDEN;
      const cos = Math.cos((base[1] * Math.PI) / 180) || 1;
      coord = [base[0] + (radius * Math.cos(angle)) / cos, base[1] + radius * Math.sin(angle)];
    }
    points.push({ id: person.id, person, coord, branch: branchOf(person.id), deceased: isDeceased(person) });
  }

  // Migratie: per ouder–kind-link de geboorteplaatsen verbinden (alleen als ze verschillen).
  const migration: GlobeArc[] = [];
  for (const link of graph.parentLinks) {
    const from = birthCoord(byId.get(link.parent));
    const to = birthCoord(byId.get(link.child));
    if (from && to && !same(from, to)) {
      migration.push({ id: `mig-${link.id}`, from, to, branch: branchOf(link.child), sourceId: link.parent, targetId: link.child });
    }
  }

  // Levenspad: geboorte → woonplaatsen (chronologisch) → overlijden. Een persoon
  // krijgt alleen een pad als er naast de geboorteplaats iéts te reizen valt
  // (een sterfteplaats of minstens één woonplaats met coördinaten).
  const lifePaths: LifePath[] = [];
  for (const person of graph.persons) {
    const birth = birthCoord(person);
    if (!birth) continue;
    const death = deathCoord(person);
    const residences = (person.residences ?? [])
      .map((r) => ({ from: r.from?.year ?? Number.POSITIVE_INFINITY, coord: placeCoord(r.place) }))
      .filter((r): r is { from: number; coord: [number, number] } => r.coord !== null)
      .sort((a, b) => a.from - b.from);
    if (!death && residences.length === 0) continue;

    const stops: LifeStop[] = [{ coord: birth, kind: 'birth' }];
    for (const r of residences) stops.push({ coord: r.coord, kind: 'residence' });
    if (death) stops.push({ coord: death, kind: 'death' });
    // Opeenvolgende identieke haltes samenvouwen (bv. laatste woonplaats == sterfteplaats);
    // de laatste halte wint qua soort, zodat een ✕ blijft staan.
    const dedup: LifeStop[] = [];
    for (const s of stops) {
      const prev = dedup[dedup.length - 1];
      if (prev && same(prev.coord, s.coord)) dedup[dedup.length - 1] = s;
      else dedup.push(s);
    }
    if (dedup.length < 2) continue;
    lifePaths.push({ id: `life-${person.id}`, personId: person.id, branch: branchOf(person.id), stops: dedup });
  }

  // Begin-oriëntatie + zoom uit de spreiding van de geboorteplaatsen.
  const birthCoords = points.map((p) => birthCoord(p.person)!).filter(Boolean);
  const center: [number, number] =
    birthCoords.length > 0
      ? (geoCentroid({ type: 'MultiPoint', coordinates: birthCoords }) as [number, number])
      : [0, 20];
  const spread = birthCoords.reduce((max, c) => Math.max(max, geoDistance(center, c)), 0);

  return { points, migration, lifePaths, center, spread };
}
