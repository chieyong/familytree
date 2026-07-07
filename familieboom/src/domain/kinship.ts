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
   * Generatie-index: kinderen strikt onder hun ouders, ouders vlak boven hun
   * dichtstbijzijnde kind, partners gelijkgetrokken. Drie monotoon-ophogende
   * stappen → convergeert ook bij rommelige (royal) data.
   *
   * Let op: een wortel (iemand zonder ouders in de boom) staat NIET automatisch
   * op 0. Zou dat wel zo zijn, dan zou de enige ouder van je partner — ook een
   * wortel — op grootouder-hoogte belanden i.p.v. naast je eigen ouders. Daarom
   * zakt elke ouder naar één generatie boven z'n laagste kind.
   */
  generations(): Map<PersonID, number> {
    const gen = new Map<PersonID, number>();
    for (const person of this.graph.persons) gen.set(person.id, 0);
    // Genoeg passes voor eerlijke data (convergentie ≤ boomdiepte); wat daarna
    // nog beweegt is een weggelopen kliek (zie rebasePumped).
    const maxPasses = Math.max(25, this.graph.persons.length);
    // De laatste twee passes samen: het wegpompen kan per pass een net iets
    // andere deelverzameling raken.
    let prev = new Set<PersonID>();
    let last = new Set<PersonID>();
    let converged = false;
    for (let i = 0; i < maxPasses; i++) {
      const changed = this.generationPass(gen);
      if (changed.size === 0) {
        converged = true;
        break;
      }
      prev = last;
      last = changed;
    }
    const pumped = new Set([...prev, ...last]);
    if (!converged) {
      // Niet geconvergeerd: dichte huwelijken-binnen-de-familie (royals) kunnen
      // een positieve cyclus vormen die dezelfde kliek elke pass één generatie
      // verder omhoog duwt. De ínterne structuur van die kliek is dan al lang
      // stabiel — alleen de offset loopt weg, en er gaapt een gat van
      // tientallen lege generaties. Zet elke weggelopen kliek terug op de plek
      // waar hij via een ouder-link (of anders een huwelijk) aan de rest vastzit.
      this.rebasePumped(gen, pumped);
    }
    // Normaliseer op 0: bij een gedeeltelijk meegedreven boom (alles gepompt)
    // blijven anders absurde absolute waarden achter. Alleen relatieve
    // afstanden doen ertoe.
    const min = Math.min(...gen.values());
    if (min !== 0) for (const [id, g] of gen) gen.set(id, g - min);
    return gen;
  }

  /** Eén relaxatie-pass; geeft de ids terug die deze pass nog bewogen. */
  private generationPass(gen: Map<PersonID, number>): Set<PersonID> {
    const changed = new Set<PersonID>();
    // 1. Kind strikt onder elke ouder.
    for (const link of this.graph.parentLinks) {
      const minChild = (gen.get(link.parent) ?? 0) + 1;
      if ((gen.get(link.child) ?? 0) < minChild) {
        gen.set(link.child, minChild);
        changed.add(link.child);
      }
    }
    // 2. Ouder zakt naar z'n dichtstbijzijnde kind: exact één generatie erboven.
    //    Houdt takken die maar één niveau diep zijn (bv. de enige ouder van je
    //    partner) uitgelijnd met de andere (schoon)ouders i.p.v. op wortelhoogte.
    for (const person of this.graph.persons) {
      let lowestChild = Infinity;
      for (const link of this.childLinksOf(person.id)) {
        lowestChild = Math.min(lowestChild, gen.get(link.child) ?? 0);
      }
      if (lowestChild === Infinity) continue;
      const hug = lowestChild - 1;
      if ((gen.get(person.id) ?? 0) < hug) {
        gen.set(person.id, hug);
        changed.add(person.id);
      }
    }
    // 3. Partners op gelijke hoogte.
    for (const union of this.graph.unions) {
      const [a, b] = union.partners;
      const top = Math.max(gen.get(a) ?? 0, gen.get(b) ?? 0);
      if (gen.get(a) !== top) { gen.set(a, top); changed.add(a); }
      if (gen.get(b) !== top) { gen.set(b, top); changed.add(b); }
    }
    return changed;
  }

  /**
   * Zet weggelopen kliekjes (personen die in de laatste pass nog bewogen)
   * terug. Per samenhangend kliekje geldt: de strakste ouder-link vanuit de
   * rest van de boom bepaalt de juiste hoogte (kind = ouder + 1); zonder zo'n
   * link een huwelijk (partners gelijk); zonder beide ankert het kliekje op 0.
   * Binnen het kliekje blijven de onderlinge afstanden intact.
   */
  private rebasePumped(gen: Map<PersonID, number>, pumped: Set<PersonID>): void {
    const adj = new Map<PersonID, PersonID[]>();
    const addEdge = (a: PersonID, b: PersonID) => {
      if (!pumped.has(a) || !pumped.has(b)) return;
      (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
      (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
    };
    for (const link of this.graph.parentLinks) addEdge(link.parent, link.child);
    for (const union of this.graph.unions) addEdge(union.partners[0], union.partners[1]);

    const seen = new Set<PersonID>();
    for (const start of pumped) {
      if (seen.has(start)) continue;
      const comp = new Set<PersonID>([start]);
      const queue = [start];
      seen.add(start);
      while (queue.length) {
        const cur = queue.pop()!;
        for (const nb of adj.get(cur) ?? []) {
          if (!seen.has(nb)) {
            seen.add(nb);
            comp.add(nb);
            queue.push(nb);
          }
        }
      }
      let shift = Infinity;
      for (const link of this.graph.parentLinks) {
        if (comp.has(link.child) && !comp.has(link.parent)) {
          shift = Math.min(shift, (gen.get(link.child) ?? 0) - (gen.get(link.parent) ?? 0) - 1);
        }
      }
      if (shift === Infinity) {
        for (const union of this.graph.unions) {
          const [a, b] = union.partners;
          if (comp.has(a) !== comp.has(b)) {
            const inner = comp.has(a) ? a : b;
            const outer = comp.has(a) ? b : a;
            shift = Math.min(shift, (gen.get(inner) ?? 0) - (gen.get(outer) ?? 0));
          }
        }
      }
      if (shift === Infinity) {
        shift = Math.min(...[...comp].map((id) => gen.get(id) ?? 0));
      }
      if (shift > 0) {
        for (const id of comp) gen.set(id, (gen.get(id) ?? 0) - shift);
      }
    }
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
