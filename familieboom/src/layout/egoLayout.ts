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
    const memberSet = new Set(members);
    for (let pass = 0; pass < 2; pass++) {
      // Koppel-eenheden: personen die binnen deze rij door een verbintenis
      // verbonden zijn (incl. hertrouw-ketens) horen bij elkaar en blijven
      // aaneengesloten staan.
      const root = new Map<PersonID, PersonID>(members.map((m) => [m, m]));
      const find = (id: PersonID): PersonID => {
        let r = id;
        while (root.get(r) !== r) r = root.get(r)!;
        return r;
      };
      for (const u of kinship.graph.unions) {
        if (memberSet.has(u.partners[0]) && memberSet.has(u.partners[1])) {
          root.set(find(u.partners[0]), find(u.partners[1]));
        }
      }
      const groups = new Map<PersonID, PersonID[]>();
      for (const m of members) {
        const r = find(m);
        (groups.get(r) ?? groups.set(r, []).get(r)!).push(m);
      }

      const placedParents = (id: PersonID) =>
        kinship.parentLinksOf(id).map((l) => x.get(l.parent)).filter((v): v is number => v !== undefined);
      const placedChildren = (id: PersonID) =>
        kinship.childLinksOf(id).map((l) => x.get(l.child)).filter((v): v is number => v !== undefined);

      // Anker per koppel: bij voorkeur de ouders (siblings staan zo onder hun
      // ouders, op geboortejaar), anders de kinderen (ouders staan boven hun
      // kinderen — ook als maar één partner aan de kinderen gekoppeld is).
      const units = [...groups.values()].map((gm) => {
        gm.sort((a, b) => birthOf(a) - birthOf(b));
        const parentXs = gm.flatMap(placedParents);
        const childXs = gm.flatMap(placedChildren);
        const anchor: number | null = parentXs.length
          ? avg(parentXs)
          : childXs.length
            ? avg(childXs)
            : null;
        return { gm, anchor, branch: branches.get(gm[0]) ?? 0, birth: birthOf(gm[0]) };
      });
      // Eenheden zonder anker (bv. ooms/tantes van wie de ouders buiten het
      // generatie-venster vallen) compact NA de verankerde eenheden zetten.
      // Een tak-index-anker zette ze op een willekeurige, soms zeer verre plek.
      const loose = units
        .filter((u) => u.anchor === null)
        .sort((a, b) => a.branch - b.branch || a.birth - b.birth);
      const edge = Math.max(0, ...units.filter((u) => u.anchor !== null).map((u) => u.anchor!));
      loose.forEach((u, i) => {
        u.anchor = edge + gapFor(members.length) * (i + 1);
      });
      units.sort((a, b) => a.anchor! - b.anchor! || a.birth - b.birth);

      const seq: PersonID[] = [];
      const desired = new Map<PersonID, number>();
      for (const u of units) {
        for (const m of u.gm) {
          seq.push(m);
          desired.set(m, u.anchor!);
        }
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
