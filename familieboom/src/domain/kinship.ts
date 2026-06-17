import type {
  FamilyGraph,
  ParentChildLink,
  Person,
  PersonID,
  Union,
  Visibility,
} from '../data/types';

// ---------------------------------------------------------------------------
// Zichtbaarheid — "strengste wint"
// ---------------------------------------------------------------------------

const VISIBILITY_RANK: Record<Visibility, number> = { private: 0, family: 1, public: 2 };

/**
 * De strengste zichtbaarheid wint: het resultaat is nooit ruimer dan de
 * striktste input. Familiedata is gedeeld eigendom — een relatie is pas
 * zichtbaar als álle betrokkenen dat toestaan.
 */
export function strictestVisibility(...levels: Visibility[]): Visibility {
  return levels.reduce(
    (acc, level) => (VISIBILITY_RANK[level] < VISIBILITY_RANK[acc] ? level : acc),
    'public',
  );
}

export function effectiveUnionVisibility(union: Union, a: Person, b: Person): Visibility {
  return strictestVisibility(union.visibility, a.visibility, b.visibility);
}

export function effectiveParentLinkVisibility(
  link: ParentChildLink,
  parent: Person,
  child: Person,
): Visibility {
  return strictestVisibility(link.visibility, parent.visibility, child.visibility);
}

// ---------------------------------------------------------------------------
// Graph-index + afgeleide verwantschap
// ---------------------------------------------------------------------------

export type SiblingKind = 'full' | 'half' | 'step';

export class KinshipService {
  readonly graph: FamilyGraph;
  readonly personById = new Map<PersonID, Person>();
  private parentLinksByChild = new Map<PersonID, ParentChildLink[]>();
  private parentLinksByParent = new Map<PersonID, ParentChildLink[]>();
  private unionsByPerson = new Map<PersonID, Union[]>();

  constructor(graph: FamilyGraph) {
    this.graph = graph;
    for (const person of graph.persons) this.personById.set(person.id, person);
    for (const link of graph.parentLinks) {
      push(this.parentLinksByChild, link.child, link);
      push(this.parentLinksByParent, link.parent, link);
    }
    for (const union of graph.unions) {
      push(this.unionsByPerson, union.partners[0], union);
      push(this.unionsByPerson, union.partners[1], union);
    }
  }

  parentLinksOf(child: PersonID): ParentChildLink[] {
    return this.parentLinksByChild.get(child) ?? [];
  }

  childLinksOf(parent: PersonID): ParentChildLink[] {
    return this.parentLinksByParent.get(parent) ?? [];
  }

  unionsOf(person: PersonID): Union[] {
    return this.unionsByPerson.get(person) ?? [];
  }

  bioParentsOf(child: PersonID): PersonID[] {
    return this.parentLinksOf(child)
      .filter((l) => l.role === 'biological')
      .map((l) => l.parent);
  }

  /** Siblings worden nooit opgeslagen, altijd afgeleid uit ouderlinks. */
  siblingKind(a: PersonID, b: PersonID): SiblingKind | null {
    if (a === b) return null;
    const parentsA = new Set(this.bioParentsOf(a));
    const parentsB = this.bioParentsOf(b);
    const shared = parentsB.filter((parent) => parentsA.has(parent)).length;
    if (shared >= 2) return 'full';
    if (shared === 1) return 'half';
    // Stiefsibling: een ouder van A heeft een verbintenis met een ouder van B.
    for (const parentA of parentsA) {
      for (const union of this.unionsOf(parentA)) {
        const partner = union.partners[0] === parentA ? union.partners[1] : union.partners[0];
        if (parentsB.includes(partner)) return 'step';
      }
    }
    return null;
  }

  /** Aantal nakomelingen (bio + adoptie) — gebruikt als visuele encoding (nodegrootte). */
  descendantCount(person: PersonID, seen = new Set<PersonID>()): number {
    let count = 0;
    for (const link of this.childLinksOf(person)) {
      if (link.role === 'step' || link.role === 'foster') continue;
      if (seen.has(link.child)) continue;
      seen.add(link.child);
      count += 1 + this.descendantCount(link.child, seen);
    }
    return count;
  }

  /**
   * Generatie-index: wortels (zonder ouders) op 0, kinderen onder hun ouders,
   * partners gelijkgetrokken. Monotoon ophogen → convergeert ook bij
   * rommelige (royal) data.
   */
  generations(): Map<PersonID, number> {
    const gen = new Map<PersonID, number>();
    for (const person of this.graph.persons) gen.set(person.id, 0);
    for (let i = 0; i < 25; i++) {
      let changed = false;
      for (const link of this.graph.parentLinks) {
        const minChild = (gen.get(link.parent) ?? 0) + 1;
        if ((gen.get(link.child) ?? 0) < minChild) {
          gen.set(link.child, minChild);
          changed = true;
        }
      }
      for (const union of this.graph.unions) {
        const [a, b] = union.partners;
        const top = Math.max(gen.get(a) ?? 0, gen.get(b) ?? 0);
        if (gen.get(a) !== top) { gen.set(a, top); changed = true; }
        if (gen.get(b) !== top) { gen.set(b, top); changed = true; }
      }
      if (!changed) break;
    }
    return gen;
  }

  /**
   * Stamtak per persoon, voor data-gedreven kleur. Kinderen erven de tak van
   * hun bloed-ouder (de ouder die zélf ouders in de boom heeft), zodat alle
   * kinderen van één paar dezelfde kleur krijgen — onafhankelijk van de
   * opslagvolgorde van de ouder-links. Aangetrouwden krijgen een eigen tak.
   */
  branches(): Map<PersonID, number> {
    const branch = new Map<PersonID, number>();
    let nextBranch = 0;
    const roots = this.graph.persons.filter((person) => this.parentLinksOf(person.id).length === 0);
    for (const root of roots) {
      if (branch.has(root.id)) continue;
      // Wortels die al getrouwd zijn met een eerder genummerde wortel delen die tak.
      const partnerBranch = this.unionsOf(root.id)
        .map((u) => branch.get(u.partners[0] === root.id ? u.partners[1] : u.partners[0]))
        .find((b) => b !== undefined);
      branch.set(root.id, partnerBranch ?? nextBranch++);
    }
    for (let i = 0; i < 25; i++) {
      let changed = false;
      for (const person of this.graph.persons) {
        if (branch.has(person.id)) continue;
        const parents = this.parentLinksOf(person.id).map((l) => l.parent);
        // Voorkeur voor bloed-ouders (die zelf ouders hebben) boven aangetrouwde;
        // bij meerdere de laagste (al bekende) tak → deterministisch, gelijk voor siblings.
        const blood = parents.filter((p) => this.parentLinksOf(p).length > 0);
        const pool = blood.length > 0 ? blood : parents;
        let inherited: number | undefined;
        for (const p of pool) {
          const b = branch.get(p);
          if (b !== undefined && (inherited === undefined || b < inherited)) inherited = b;
        }
        // Partner-terugval alleen voor wie géén ouders in de boom heeft (echt
        // ingetrouwd). Wie wel ouders heeft, wacht op de bloed-tak — anders pikt
        // een kind door de verwerkingsvolgorde de kleur van zijn partner op.
        if (inherited === undefined && parents.length === 0) {
          inherited = this.unionsOf(person.id)
            .map((u) => branch.get(u.partners[0] === person.id ? u.partners[1] : u.partners[0]))
            .find((b) => b !== undefined);
        }
        if (inherited !== undefined) {
          branch.set(person.id, inherited);
          changed = true;
        }
      }
      if (!changed) break;
    }
    return branch;
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
