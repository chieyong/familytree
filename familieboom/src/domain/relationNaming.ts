import type { ParentRole, Person, PersonID, UnionType } from '../data/types';
import { KinshipService } from './kinship';

/**
 * Nederlandse relatie-benoeming. Kortste pad door de graph (ouder/kind/
 * partner-stappen), geclassificeerd naar een Nederlands label, altijd met
 * een pad-ondertitel waar het label dubbelzinnig is ("neef" = cousin én
 * oomzegger). Bij meerdere even korte paden komt de bloedlijn eerst en
 * verschijnen alternatieven als "ook: …".
 */

export interface RelationDescription {
  label: string;
  subtitle?: string;
  also?: string[];
}

type Hop =
  | { kind: 'up'; role: ParentRole }
  | { kind: 'down'; role: ParentRole }
  | { kind: 'partner'; ended: boolean; type: UnionType };

interface Path {
  persons: PersonID[]; // [ego, ..., target]
  hops: Hop[];
}

const MAX_DEPTH = 8;
const MAX_PATHS = 12;

export function describeRelation(
  kinship: KinshipService,
  egoId: PersonID,
  targetId: PersonID,
): RelationDescription {
  if (egoId === targetId) return { label: 'jijzelf' };
  const paths = shortestPaths(kinship, egoId, targetId);
  if (paths.length === 0) {
    return { label: `geen familieverband binnen ${MAX_DEPTH} stappen` };
  }
  // Bloedlijn eerst: paden met de minste partner-sprongen.
  paths.sort((a, b) => partnerHops(a) - partnerHops(b));
  const primary = classify(kinship, egoId, paths[0]);
  const also = [
    ...new Set(
      paths.slice(1).map((path) => classify(kinship, egoId, path).label),
    ),
  ].filter((label) => label !== primary.label);
  return also.length > 0 ? { ...primary, also } : primary;
}

const partnerHops = (path: Path): number =>
  path.hops.filter((hop) => hop.kind === 'partner').length;

// ---------------------------------------------------------------------------
// Kortste paden (BFS met voorgangers, alle even korte paden)
// ---------------------------------------------------------------------------

interface Edge {
  to: PersonID;
  hop: Hop;
}

function shortestPaths(kinship: KinshipService, ego: PersonID, target: PersonID): Path[] {
  const edges = new Map<PersonID, Edge[]>();
  const addEdge = (from: PersonID, edge: Edge) => {
    if (!edges.has(from)) edges.set(from, []);
    edges.get(from)!.push(edge);
  };
  for (const link of kinship.graph.parentLinks) {
    addEdge(link.child, { to: link.parent, hop: { kind: 'up', role: link.role } });
    addEdge(link.parent, { to: link.child, hop: { kind: 'down', role: link.role } });
  }
  for (const union of kinship.graph.unions) {
    const hop: Hop = {
      kind: 'partner',
      ended: union.end !== undefined && union.end.reason !== 'death',
      type: union.type,
    };
    addEdge(union.partners[0], { to: union.partners[1], hop });
    addEdge(union.partners[1], { to: union.partners[0], hop });
  }

  const dist = new Map<PersonID, number>([[ego, 0]]);
  const preds = new Map<PersonID, { from: PersonID; hop: Hop }[]>();
  let frontier = [ego];
  while (frontier.length > 0 && !dist.has(target) && (dist.get(frontier[0]) ?? 0) < MAX_DEPTH) {
    const next: PersonID[] = [];
    for (const current of frontier) {
      for (const edge of edges.get(current) ?? []) {
        if (!dist.has(edge.to)) {
          dist.set(edge.to, dist.get(current)! + 1);
          next.push(edge.to);
        }
        if (dist.get(edge.to) === dist.get(current)! + 1) {
          if (!preds.has(edge.to)) preds.set(edge.to, []);
          preds.get(edge.to)!.push({ from: current, hop: edge.hop });
        }
      }
    }
    frontier = next;
  }
  if (!dist.has(target)) return [];

  const paths: Path[] = [];
  const walk = (id: PersonID, suffixPersons: PersonID[], suffixHops: Hop[]) => {
    if (paths.length >= MAX_PATHS) return;
    if (id === ego) {
      paths.push({ persons: [ego, ...suffixPersons], hops: suffixHops });
      return;
    }
    for (const pred of preds.get(id) ?? []) {
      walk(pred.from, [id, ...suffixPersons], [pred.hop, ...suffixHops]);
    }
  };
  walk(target, [], []);
  return paths;
}

// ---------------------------------------------------------------------------
// Classificatie naar Nederlands
// ---------------------------------------------------------------------------

const word = (person: Person | undefined, m: string, f: string, x: string): string =>
  person?.sex === 'm' ? m : person?.sex === 'f' ? f : x;

const zoonDochter = (p?: Person) => word(p, 'zoon', 'dochter', 'kind');
const vaderMoeder = (p?: Person) => word(p, 'vader', 'moeder', 'ouder');
const broerZus = (p?: Person) => word(p, 'broer', 'zus', 'broer/zus');
const oomTante = (p?: Person) => word(p, 'oom', 'tante', 'oom/tante');
const neefNicht = (p?: Person) => word(p, 'neef', 'nicht', 'neef/nicht');

function classify(kinship: KinshipService, egoId: PersonID, path: Path): RelationDescription {
  const get = (id: PersonID) => kinship.personById.get(id);
  const target = get(path.persons[path.persons.length - 1]);
  const key = path.hops.map((h) => (h.kind === 'partner' ? 'p' : h.kind === 'up' ? 'u' : 'd')).join('');
  const via = (): string | undefined => {
    const middle = path.persons.slice(1, -1).map((id) => naam(get(id)));
    if (middle.length === 0) return undefined;
    if (middle.length === 1) return `via ${middle[0]}`;
    return `via ${middle.slice(0, -1).join(', ')} en ${middle[middle.length - 1]}`;
  };

  // Directe ouder/kind, incl. adoptie- en stiefnuance uit de linkrol.
  if (key === 'u') {
    const role = (path.hops[0] as { role: ParentRole }).role;
    const base = vaderMoeder(target);
    if (role === 'adoptive') return { label: `adoptie${base}` };
    if (role === 'step' || role === 'foster') return { label: `stief${base}` };
    return { label: base };
  }
  if (key === 'd') {
    const role = (path.hops[0] as { role: ParentRole }).role;
    const base = zoonDochter(target);
    const label = role === 'adoptive' ? `adoptie${base}` : role === 'step' || role === 'foster' ? `stief${base}` : base;
    const otherParents = kinship
      .parentLinksOf(path.persons[1])
      .filter((l) => l.parent !== egoId)
      .map((l) => naam(get(l.parent)));
    return { label, subtitle: otherParents.length > 0 ? `andere ouder: ${otherParents.join(', ')}` : undefined };
  }

  // Bloedlijn recht omhoog/omlaag.
  if (/^u+$/.test(key)) {
    const n = key.length;
    if (n === 2) return { label: `groot${vaderMoeder(target)}`, subtitle: via() };
    if (n === 3) return { label: `overgroot${vaderMoeder(target)}`, subtitle: via() };
    if (n === 4) return { label: `betovergroot${vaderMoeder(target)}`, subtitle: via() };
    return { label: `voorouder (${n} generaties)`, subtitle: via() };
  }
  if (/^d+$/.test(key)) {
    const n = key.length;
    if (n === 2) return { label: `klein${zoonDochter(target)}`, subtitle: via() };
    if (n === 3) return { label: `achterklein${zoonDochter(target)}`, subtitle: via() };
    return { label: `nazaat (${n} generaties)`, subtitle: via() };
  }

  switch (key) {
    case 'ud': {
      const kind = kinship.siblingKind(egoId, path.persons[2]);
      if (kind === 'half') return { label: `half${broerZus(target)}` };
      if (kind === 'step') return { label: `stief${broerZus(target)}` };
      return { label: broerZus(target) };
    }
    case 'uud':
      return { label: oomTante(target), subtitle: via() };
    case 'uudp':
      // Partner van je oom/tante.
      return { label: `aangetrouwde ${oomTante(target)}`, subtitle: via() };
    case 'uuud':
      return { label: word(target, 'oudoom', 'oudtante', 'oudoom/-tante'), subtitle: via() };
    case 'udd': {
      const sibling = path.persons[2];
      const kind = kinship.siblingKind(egoId, sibling);
      const sibTerm = `${kind === 'half' ? 'half' : kind === 'step' ? 'stief' : ''}${broerZus(get(sibling))}`;
      return {
        label: neefNicht(target),
        subtitle: `${zoonDochter(target)} van je ${sibTerm} ${naam(get(sibling))}`,
      };
    }
    case 'uudd': {
      const parentSibling = path.persons[3];
      return {
        label: neefNicht(target),
        subtitle: `${zoonDochter(target)} van je ${oomTante(get(parentSibling))} ${naam(get(parentSibling))}`,
      };
    }
    case 'p': {
      const hop = path.hops[0] as { ended: boolean; type: UnionType };
      if (hop.ended) return { label: 'ex-partner' };
      if (hop.type === 'marriage' || hop.type === 'registered') {
        return { label: word(target, 'echtgenoot', 'echtgenote', 'partner') };
      }
      return { label: 'partner' };
    }
    case 'up': {
      const hop = path.hops[1] as { ended: boolean };
      if (!hop.ended) return { label: `stief${vaderMoeder(target)}`, subtitle: via() };
      break; // ex-partner van je ouder → generieke benoeming
    }
    case 'pd':
      return { label: `stief${zoonDochter(target)}`, subtitle: via() };
    case 'upd':
      return { label: `stief${broerZus(target)}`, subtitle: via() };
    case 'pu':
      return { label: `schoon${vaderMoeder(target)}`, subtitle: via() };
    case 'dp':
      return { label: `schoon${zoonDochter(target)}`, subtitle: via() };
    case 'udp':
    case 'pud':
      return { label: word(target, 'zwager', 'schoonzus', 'zwager/schoonzus'), subtitle: via() };
    case 'du':
      return { label: `${vaderMoeder(target)} van je ${zoonDochter(get(path.persons[1]))}`, subtitle: via() };
  }

  return {
    label: key.includes('p') ? 'aangetrouwde verwant' : 'verre bloedverwant',
    subtitle: via(),
  };
}

const naam = (person?: Person): string => {
  if (!person) return '?';
  const value =
    person.displayName ?? [person.givenNames?.[0], person.familyName].filter(Boolean).join(' ');
  return value === '' || /^Q\d+$/.test(value) ? 'naam onbekend' : value;
};
