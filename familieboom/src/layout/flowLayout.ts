import type { FamilyGraph, PersonID } from '../data/types';
import { KinshipService } from '../domain/kinship';
import type { LayoutLink, LayoutNode, LayoutResult } from './types';

/**
 * Kunstwerk-layout "levenslijnen": verticale tijdas (jaar = y-positie), elke
 * persoon een levenslijn van geboorte tot overlijden. Kinderen ontspringen
 * aan de levenslijn van hun ouder op het geboortemoment; huwelijken verbinden
 * twee levenslijnen in het huwelijksjaar. Positie draagt dus betekenis —
 * geen decoratieve maar een data-gedreven compositie.
 */

const YEAR_SCALE = 7; // px per jaar
const COL_GAP = 66;
const CURRENT_YEAR = 2026;

export interface Lifeline {
  id: PersonID;
  path: string;
  branch: number;
  living: boolean;
}

export interface FlowLayoutResult extends LayoutResult {
  lifelines: Lifeline[];
  decades: { y: number; year: number }[];
}

export function flowLayout(graph: FamilyGraph): FlowLayoutResult {
  const kinship = new KinshipService(graph);
  const generations = kinship.generations();
  const branches = kinship.branches();
  const birthYear = estimateBirthYears(graph, kinship);

  const minYear = Math.min(...birthYear.values());
  const yOf = (year: number) => (year - minYear) * YEAR_SCALE;
  // Levenslijn-einde: sterfjaar, anders geschat (historische data zonder
  // sterfdatum mag niet tot vandaag doorlopen).
  const endYearOf = (id: PersonID): number => {
    const person = kinship.personById.get(id);
    const death = person?.death?.date?.year;
    if (death !== undefined) return death;
    return Math.min((birthYear.get(id) ?? minYear) + 75, CURRENT_YEAR);
  };
  const isLiving = (id: PersonID): boolean =>
    kinship.personById.get(id)?.death === undefined &&
    (birthYear.get(id) ?? 0) + 100 >= CURRENT_YEAR;

  // x per generatie. Echtparen (of hertrouw-ketens) binnen één generatie
  // vormen één blok: er kan nooit een derde tussen twee echtgenoten belanden —
  // huwelijks-nabijheid gaat vóór ouder-nabijheid. Kinderen ankeren daardoor
  // vanzelf op het koppelmidden. Drie sweeps (ouders ↓, kinderen ↑, ↓) drukken
  // de kruisingen tussen generaties.
  const x = new Map<PersonID, number>();
  const maxGen = Math.max(0, ...generations.values());
  const INNER_GAP = COL_GAP; // koppels aaneengesloten, maar niet samengeperst

  const rowsByGen: PersonID[][] = [];
  for (let g = 0; g <= maxGen; g++) {
    rowsByGen.push(
      graph.persons.filter((person) => generations.get(person.id) === g).map((p) => p.id),
    );
  }
  const unitsByGen = rowsByGen.map((row) => coupleUnits(row, graph.unions));

  const memberDesired = (id: PersonID): number | undefined => {
    const anchors: number[] = [];
    for (const link of kinship.parentLinksOf(id)) {
      const anchorX = x.get(link.parent);
      if (anchorX !== undefined) anchors.push(anchorX);
    }
    for (const link of kinship.childLinksOf(id)) {
      const anchorX = x.get(link.child);
      if (anchorX !== undefined) anchors.push(anchorX);
    }
    return anchors.length > 0 ? anchors.reduce((s, v) => s + v, 0) / anchors.length : undefined;
  };

  const placeGen = (units: PersonID[][]) => {
    const entries = units.map((unit) => {
      const wants = unit
        .map(memberDesired)
        .filter((v): v is number => v !== undefined);
      return {
        unit,
        want:
          wants.length > 0
            ? wants.reduce((s, v) => s + v, 0) / wants.length
            : (branches.get(unit[0]) ?? 0) * COL_GAP * 3,
      };
    });
    entries.sort(
      (a, b) =>
        a.want - b.want || (birthYear.get(a.unit[0]) ?? 0) - (birthYear.get(b.unit[0]) ?? 0),
    );
    let prevRight = -Infinity;
    let driftSum = 0;
    const placed: { unit: PersonID[]; left: number }[] = [];
    for (const entry of entries) {
      const unitWidth = (entry.unit.length - 1) * INNER_GAP;
      const left = Math.max(entry.want - unitWidth / 2, prevRight + COL_GAP);
      placed.push({ unit: entry.unit, left });
      driftSum += left + unitWidth / 2 - entry.want;
      prevRight = left + unitWidth;
    }
    const drift = driftSum / (placed.length || 1);
    for (const p of placed) {
      p.unit.forEach((id, i) => x.set(id, p.left + i * INNER_GAP - drift));
    }
  };

  // Eén pass van oud naar jong: kinderen volgen hun ouders. (Een extra
  // bottom-up sweep klonk de compositie samen — bewust weggelaten.)
  for (const g of rowsByGen.keys()) placeGen(unitsByGen[g]);

  const nodes: LayoutNode[] = graph.persons.map((person) => ({
    person,
    x: x.get(person.id) ?? 0,
    y: yOf(birthYear.get(person.id) ?? minYear),
    r: 3.5 + Math.sqrt(kinship.descendantCount(person.id)) * 2.2,
    generation: generations.get(person.id) ?? 0,
    branch: branches.get(person.id) ?? 0,
    deceased: person.death !== undefined,
  }));
  const nodeById = new Map(nodes.map((node) => [node.person.id, node]));

  // Levenslijnen met een subtiele organische welving.
  const lifelines: Lifeline[] = graph.persons.map((person) => {
    const px = x.get(person.id) ?? 0;
    const y0 = yOf(birthYear.get(person.id) ?? minYear);
    const y1 = yOf(endYearOf(person.id));
    const sway = jitter(person.id) * 7;
    const midY = (y0 + y1) / 2;
    return {
      id: person.id,
      path: `M${px},${y0} C${px + sway},${midY} ${px - sway},${midY} ${px},${y1}`,
      branch: branches.get(person.id) ?? 0,
      living: isLiving(person.id),
    };
  });

  const links: LayoutLink[] = [];
  for (const link of graph.parentLinks) {
    const child = nodeById.get(link.child);
    const parentX = x.get(link.parent);
    if (!child || parentX === undefined) continue;
    // Het kind ontspringt aan de levenslijn van de ouder: de tak verlaat de
    // ouderlijn iets vóór de geboorte en zwenkt omlaag naar het geboortepunt.
    const y = child.y;
    const takeoffY = y - 30 - Math.abs(jitter(link.id)) * 10;
    const c2x = parentX + (child.x - parentX) * 0.45;
    links.push({
      id: link.id,
      kind: 'parent',
      role: link.role,
      path: `M${parentX},${takeoffY} C${parentX},${y - 2} ${c2x},${y} ${child.x},${y}`,
      sourceId: link.parent,
      targetId: link.child,
    });
  }
  for (const union of graph.unions) {
    const a = nodeById.get(union.partners[0]);
    const b = nodeById.get(union.partners[1]);
    if (!a || !b) continue;
    const year =
      union.start?.year ??
      Math.max(birthYear.get(a.person.id) ?? minYear, birthYear.get(b.person.id) ?? minYear) + 25;
    const y = yOf(year);
    // Boog-hoogte puur proportioneel: naburige koppels krijgen een subtiel
    // bruggetje, alleen verre (hertrouw)verbintenissen een grote boog.
    const lift = Math.abs(b.x - a.x) * 0.16 + Math.abs(jitter(union.id)) * 3;
    links.push({
      id: union.id,
      kind: 'union',
      unionType: union.type,
      ended: union.end !== undefined && union.end.reason !== 'death',
      path: `M${a.x},${y} C${a.x},${y - lift} ${b.x},${y - lift} ${b.x},${y}`,
      sourceId: union.partners[0],
      targetId: union.partners[1],
    });
  }

  const maxYear = Math.max(...graph.persons.map((person) => endYearOf(person.id)));
  const step = maxYear - minYear > 200 ? 25 : 10;
  const decades: { y: number; year: number }[] = [];
  for (let year = Math.ceil(minYear / step) * step; year <= maxYear; year += step) {
    decades.push({ y: yOf(year), year });
  }

  const xs = nodes.map((node) => node.x);
  const padX = 110;
  const minX = Math.min(...xs) - padX;
  return {
    nodes,
    links,
    lifelines,
    decades,
    bounds: [minX, -70, Math.max(...xs) + padX - minX, yOf(maxYear) + 200],
  };
}

/**
 * Geboortejaar met fallback voor onvolledige (historische) data:
 * ouders + ~29 jaar, of het jaar van de partner.
 */
function estimateBirthYears(graph: FamilyGraph, kinship: KinshipService): Map<PersonID, number> {
  const year = new Map<PersonID, number>();
  for (const person of graph.persons) {
    if (person.birth?.date?.year !== undefined) year.set(person.id, person.birth.date.year);
  }
  for (let i = 0; i < 10; i++) {
    let changed = false;
    for (const person of graph.persons) {
      if (year.has(person.id)) continue;
      const parentYears = kinship
        .parentLinksOf(person.id)
        .map((link) => year.get(link.parent))
        .filter((y): y is number => y !== undefined);
      const partnerYears = kinship
        .unionsOf(person.id)
        .map((u) => year.get(u.partners[0] === person.id ? u.partners[1] : u.partners[0]))
        .filter((y): y is number => y !== undefined);
      if (parentYears.length > 0) {
        year.set(person.id, parentYears.reduce((s, v) => s + v, 0) / parentYears.length + 29);
        changed = true;
      } else if (partnerYears.length > 0) {
        year.set(person.id, partnerYears[0]);
        changed = true;
      }
    }
    if (!changed) break;
  }
  for (const person of graph.persons) {
    if (!year.has(person.id)) year.set(person.id, 1950);
  }
  return year;
}

/**
 * Groepeer rijgenoten die (ooit) een verbintenis delen tot één blok.
 * Hertrouw-ketens (A–B, B–C) worden als pad geordend zodat de gedeelde
 * persoon tussen beide partners in staat.
 */
function coupleUnits(rowIds: PersonID[], unions: { partners: [PersonID, PersonID] }[]): PersonID[][] {
  const inRow = new Set(rowIds);
  const neighbors = new Map<PersonID, PersonID[]>();
  for (const union of unions) {
    const [a, b] = union.partners;
    if (!inRow.has(a) || !inRow.has(b)) continue;
    if (!neighbors.has(a)) neighbors.set(a, []);
    if (!neighbors.has(b)) neighbors.set(b, []);
    neighbors.get(a)!.push(b);
    neighbors.get(b)!.push(a);
  }
  const seen = new Set<PersonID>();
  const units: PersonID[][] = [];
  for (const id of rowIds) {
    if (seen.has(id)) continue;
    if (!neighbors.has(id)) {
      seen.add(id);
      units.push([id]);
      continue;
    }
    // Verzamel de component en orden als keten vanaf een uiteinde.
    const component: PersonID[] = [];
    const stack = [id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      component.push(current);
      for (const next of neighbors.get(current) ?? []) {
        if (!seen.has(next)) stack.push(next);
      }
    }
    const start =
      component.find((c) => (neighbors.get(c) ?? []).filter((n) => component.includes(n)).length <= 1) ??
      component[0];
    const ordered: PersonID[] = [start];
    const visited = new Set<PersonID>([start]);
    let current = start;
    while (true) {
      const next = (neighbors.get(current) ?? []).find(
        (n) => component.includes(n) && !visited.has(n),
      );
      if (!next) break;
      ordered.push(next);
      visited.add(next);
      current = next;
    }
    // Vertakte componenten (zeldzaam): restleden achteraan.
    for (const member of component) if (!visited.has(member)) ordered.push(member);
    units.push(ordered);
  }
  return units;
}

function jitter(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 500 - 1;
}
