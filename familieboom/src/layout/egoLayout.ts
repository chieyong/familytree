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
    const inRow = new Set(members);
    for (let pass = 0; pass < 2; pass++) {
      const parentXsOf = (id: PersonID): number[] =>
        kinship
          .parentLinksOf(id)
          .map((l) => x.get(l.parent))
          .filter((v): v is number => v !== undefined);
      const partnersInRow = (id: PersonID): PersonID[] =>
        kinship
          .unionsOf(id)
          .map((u) => (u.partners[0] === id ? u.partners[1] : u.partners[0]))
          .filter((p) => inRow.has(p));

      // Bloed-kinderen van dit niveau (met een geplaatste ouder), op
      // ouder-positie dan geboortejaar — siblings van hetzelfde paar delen de
      // ouder-positie, dus die staan zuiver op geboortejaar.
      const childAnchor = new Map<PersonID, number>();
      const children = members
        .filter((id) => parentXsOf(id).length > 0)
        .sort((a, b) => avg(parentXsOf(a)) - avg(parentXsOf(b)) || birthOf(a) - birthOf(b));
      for (const c of children) childAnchor.set(c, avg(parentXsOf(c)));

      // Sequentie: elk kind, direct gevolgd door zijn partner(s) — recursief,
      // zodat een koppel altijd aaneengesloten staat (ook bij hertrouw-ketens).
      const seq: PersonID[] = [];
      const seen = new Set<PersonID>();
      const emit = (id: PersonID) => {
        if (seen.has(id)) return;
        seen.add(id);
        seq.push(id);
        for (const p of partnersInRow(id)) emit(p);
      };
      for (const c of children) emit(c);
      for (const m of members.filter((m) => !seen.has(m)).sort((a, b) => birthOf(a) - birthOf(b))) {
        seq.push(m);
      }

      // Plaatsing: kind onder zijn ouders; partner bij het kind; anders eigen
      // kinderen of tak. spaceOut houdt de sequentie-volgorde + minimale afstand.
      const desired = new Map<PersonID, number>();
      for (const id of seq) {
        if (childAnchor.has(id)) {
          desired.set(id, childAnchor.get(id)!);
          continue;
        }
        const spouse = partnersInRow(id).find((p) => childAnchor.has(p));
        if (spouse !== undefined) {
          desired.set(id, childAnchor.get(spouse)!);
          continue;
        }
        const childXs = kinship
          .childLinksOf(id)
          .map((l) => x.get(l.child))
          .filter((v): v is number => v !== undefined);
        desired.set(id, childXs.length ? avg(childXs) : (branches.get(id) ?? 0) * COL_WIDTH * 2);
      }
      spaceOut(seq, desired, gapFor(seq.length)).forEach((finalX, i) => x.set(seq[i], finalX));
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
