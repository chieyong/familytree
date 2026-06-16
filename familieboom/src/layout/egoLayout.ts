import type { FamilyGraph, PersonID } from '../data/types';
import { KinshipService } from '../domain/kinship';
import type { LayoutLink, LayoutNode, LayoutResult } from './types';

/**
 * Ego-centrische navigatie-layout: focuspersoon in het midden, generaties als
 * rustige horizontale rijen (ouders boven, kinderen onder), partners naast
 * elkaar. Barycentrisch geordend vanuit de ego-rij zodat takken niet kruisen
 * waar dat niet hoeft.
 */

const ROW_HEIGHT = 150;
const COL_WIDTH = 108;
const NODE_R = 22;

export function egoLayout(
  graph: FamilyGraph,
  egoId: PersonID,
  /** Takken op basis van de volledige graph, zodat kleuren stabiel blijven tijdens navigeren. */
  branchOverride?: Map<PersonID, number>,
): LayoutResult {
  const kinship = new KinshipService(graph);
  const generations = kinship.generations();
  const branches = branchOverride ?? kinship.branches();
  const egoGen = generations.get(egoId) ?? 0;

  const rows = new Map<number, PersonID[]>();
  for (const person of graph.persons) {
    const rel = (generations.get(person.id) ?? 0) - egoGen;
    if (!rows.has(rel)) rows.set(rel, []);
    rows.get(rel)!.push(person.id);
  }

  const x = new Map<PersonID, number>();

  // Drukke rijen (royals: 16 kinderen) krijgen een compactere kolombreedte.
  const gapFor = (count: number) => (count > 9 ? 76 : COL_WIDTH);

  // Ego-rij, links→rechts: oudere siblings (op geboortejaar) · ego · partner(s) ·
  // jongere siblings · overige (aangetrouwd, neven/nichten). De ego blijft op 0
  // (gecentreerd); siblings staan op echte geboortejaar-volgorde.
  const egoRow = rows.get(0) ?? [];
  const egoGap = gapFor(egoRow.length);
  const birthOf = (id: PersonID): number => kinship.personById.get(id)?.birth?.date?.year ?? 0;
  const partnerIds = [
    ...new Set(
      kinship
        .unionsOf(egoId)
        .sort((a, b) => Number(a.end !== undefined) - Number(b.end !== undefined))
        .map((u) => (u.partners[0] === egoId ? u.partners[1] : u.partners[0]))
        .filter((id) => egoRow.includes(id)),
    ),
  ];
  const isPartner = (id: PersonID) => partnerIds.includes(id);
  const siblings = egoRow.filter(
    (id) => id !== egoId && !isPartner(id) && kinship.siblingKind(egoId, id) !== null,
  );
  const others = egoRow.filter(
    (id) => id !== egoId && !isPartner(id) && kinship.siblingKind(egoId, id) === null,
  );
  const byBirth = (a: PersonID, b: PersonID) => birthOf(a) - birthOf(b);
  const olderSibs = siblings.filter((id) => birthOf(id) <= birthOf(egoId)).sort(byBirth);
  const youngerSibs = siblings.filter((id) => birthOf(id) > birthOf(egoId)).sort(byBirth);
  others.sort(byBirth);
  const seq = [...olderSibs, egoId, ...partnerIds, ...youngerSibs, ...others];
  const egoIndex = seq.indexOf(egoId);
  seq.forEach((id, i) => x.set(id, (i - egoIndex) * egoGap));

  // Overige rijen barycentrisch t.o.v. al geplaatste buren, van binnen naar
  // buiten. Twee passes per rij: in de tweede zijn rijgenoten geplaatst, zodat
  // aangetrouwden zonder eigen voorouders (bijv. een partner van een kind)
  // naast hun partner landen in plaats van op een ankerloze fallback.
  const relLevels = [...rows.keys()].filter((rel) => rel !== 0).sort((a, b) => Math.abs(a) - Math.abs(b));
  const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
  for (const rel of relLevels) {
    const members = rows.get(rel)!;
    for (let pass = 0; pass < 2; pass++) {
      const orderKey = new Map<PersonID, number>(); // bepaalt de volgorde
      const desired = new Map<PersonID, number>(); // bepaalt de fijne x-plaatsing
      for (const id of members) {
        const parentXs: number[] = [];
        for (const link of kinship.parentLinksOf(id)) {
          const ax = x.get(link.parent);
          if (ax !== undefined) parentXs.push(ax);
        }
        const childXs: number[] = [];
        for (const link of kinship.childLinksOf(id)) {
          const ax = x.get(link.child);
          if (ax !== undefined) childXs.push(ax);
        }
        const partnerXs: number[] = [];
        for (const union of kinship.unionsOf(id)) {
          const partner = union.partners[0] === id ? union.partners[1] : union.partners[0];
          const ax = x.get(partner);
          if (ax !== undefined) partnerXs.push(ax + 12);
        }
        const branchFallback = (branches.get(id) ?? 0) * COL_WIDTH * 2;
        // Volgorde primair op ouder-positie: siblings van hetzelfde paar delen
        // die exact, zodat partner/eigen kinderen de geboortejaar-volgorde niet
        // verstoren. Pas dan kind-/partner-anker, dan tak.
        orderKey.set(
          id,
          parentXs.length ? avg(parentXs)
            : childXs.length ? avg(childXs)
              : partnerXs.length ? avg(partnerXs)
                : branchFallback,
        );
        // Plaatsing weegt álle ankers mee (partner-pull houdt koppels dichtbij).
        const all = [...parentXs, ...childXs, ...partnerXs];
        desired.set(id, all.length ? avg(all) : branchFallback);
      }
      members.sort(
        (a, b) => (orderKey.get(a) ?? 0) - (orderKey.get(b) ?? 0) || compareBirth(kinship, a, b),
      );
      spaceOut(members, desired, gapFor(members.length)).forEach((finalX, i) => x.set(members[i], finalX));
    }
  }

  // Label-stagger in drukke rijen: even/oneven posities krijgen een
  // verschillende labelhoogte zodat namen elkaar niet overschrijven.
  const labelTier = new Map<PersonID, number>();
  for (const members of rows.values()) {
    if (members.length <= 1) continue;
    [...members]
      .sort((a, b) => (x.get(a) ?? 0) - (x.get(b) ?? 0))
      .forEach((id, i) => labelTier.set(id, i % 2));
  }

  // "In leven" vraagt positief bewijs: een geboortejaar binnen ~100 jaar.
  // Historische personen zonder sterfdatum (Wikidata-gaten) blijven zo hol.
  const CURRENT_YEAR = 2026;
  const isDeceasedStyle = (person: (typeof graph.persons)[number]): boolean => {
    if (person.death !== undefined) return true;
    const birthYear = person.birth?.date?.year;
    return birthYear === undefined || birthYear + 100 < CURRENT_YEAR;
  };

  const nodes: LayoutNode[] = graph.persons.map((person) => ({
    person,
    x: x.get(person.id) ?? 0,
    y: ((generations.get(person.id) ?? 0) - egoGen) * ROW_HEIGHT,
    r: person.id === egoId ? NODE_R + 6 : NODE_R,
    generation: generations.get(person.id) ?? 0,
    branch: branches.get(person.id) ?? 0,
    deceased: isDeceasedStyle(person),
    isEgo: person.id === egoId,
    labelTier: labelTier.get(person.id) ?? 0,
  }));
  const nodeById = new Map(nodes.map((node) => [node.person.id, node]));

  const links: LayoutLink[] = [];
  for (const link of graph.parentLinks) {
    const parent = nodeById.get(link.parent);
    const child = nodeById.get(link.child);
    if (!parent || !child) continue;
    const midY = (parent.y + child.y) / 2;
    links.push({
      id: link.id,
      kind: 'parent',
      role: link.role,
      path: `M${parent.x},${parent.y + parent.r} C${parent.x},${midY} ${child.x},${midY} ${child.x},${child.y - child.r - 16}`,
      sourceId: link.parent,
      targetId: link.child,
    });
  }
  for (const union of graph.unions) {
    const a = nodeById.get(union.partners[0]);
    const b = nodeById.get(union.partners[1]);
    if (!a || !b) continue;
    const [left, right] = a.x <= b.x ? [a, b] : [b, a];
    const dipY = Math.max(left.y, right.y) + 34;
    links.push({
      id: union.id,
      kind: 'union',
      unionType: union.type,
      ended: union.end !== undefined && union.end.reason !== 'death',
      path: `M${left.x},${left.y + left.r} C${left.x},${dipY} ${right.x},${dipY} ${right.x},${right.y + right.r}`,
      sourceId: union.partners[0],
      targetId: union.partners[1],
    });
  }

  // Horizontaal symmetrisch rond de ego (0,0): de focuspersoon blijft exact
  // in het horizontale midden. Verticaal volgen de bounds de inhoud, zodat
  // iemand zonder nakomelingen geen halve lege onderkant oplevert.
  const padX = 150; // ruim genoeg voor uitstekende naamlabels
  const padY = 95;
  const spanX = Math.max(...nodes.map((node) => Math.abs(node.x))) + padX;
  const minY = Math.min(...nodes.map((node) => node.y)) - padY;
  const maxY = Math.max(...nodes.map((node) => node.y)) + padY + 30;
  return {
    nodes,
    links,
    bounds: [-spanX, minY, spanX * 2, maxY - minY],
  };
}

function compareBirth(kinship: KinshipService, a: PersonID, b: PersonID): number {
  const yearA = kinship.personById.get(a)?.birth?.date?.year ?? 0;
  const yearB = kinship.personById.get(b)?.birth?.date?.year ?? 0;
  return yearA - yearB;
}

/** Houd gewenste posities aan maar dwing een minimale onderlinge afstand af, gecentreerd. */
function spaceOut(sorted: PersonID[], desired: Map<PersonID, number>, minGap: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const want = desired.get(sorted[i]) ?? 0;
    result.push(i === 0 ? want : Math.max(want, result[i - 1] + minGap));
  }
  const drift =
    result.reduce((s, v, i) => s + (v - (desired.get(sorted[i]) ?? 0)), 0) / (result.length || 1);
  return result.map((v) => v - drift);
}
