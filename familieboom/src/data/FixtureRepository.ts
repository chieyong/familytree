import type { FamilyRepository } from './FamilyRepository';
import type { FamilyGraph, Person, PersonID } from './types';

/** Lokale implementatie op een in-memory FamilyGraph (fixtures of gecachete Wikidata). */
export class FixtureRepository implements FamilyRepository {
  private graph: FamilyGraph;
  private byId = new Map<PersonID, Person>();
  private adjacency = new Map<PersonID, Set<PersonID>>();

  constructor(graph: FamilyGraph) {
    this.graph = graph;
    for (const person of graph.persons) this.byId.set(person.id, person);
    const connect = (a: PersonID, b: PersonID) => {
      if (!this.adjacency.has(a)) this.adjacency.set(a, new Set());
      if (!this.adjacency.has(b)) this.adjacency.set(b, new Set());
      this.adjacency.get(a)!.add(b);
      this.adjacency.get(b)!.add(a);
    };
    for (const link of graph.parentLinks) connect(link.parent, link.child);
    for (const union of graph.unions) connect(union.partners[0], union.partners[1]);
  }

  async getPerson(id: PersonID): Promise<Person | undefined> {
    return this.byId.get(id);
  }

  async getEgoGraph(id: PersonID, depth: number): Promise<FamilyGraph> {
    const included = new Set<PersonID>([id]);
    let frontier = [id];
    for (let d = 0; d < depth; d++) {
      const next: PersonID[] = [];
      for (const current of frontier) {
        for (const neighbor of this.adjacency.get(current) ?? []) {
          if (!included.has(neighbor)) {
            included.add(neighbor);
            next.push(neighbor);
          }
        }
      }
      frontier = next;
    }
    return {
      persons: this.graph.persons.filter((person) => included.has(person.id)),
      unions: this.graph.unions.filter((u) => included.has(u.partners[0]) && included.has(u.partners[1])),
      parentLinks: this.graph.parentLinks.filter((l) => included.has(l.parent) && included.has(l.child)),
    };
  }

  async getFullGraph(): Promise<FamilyGraph> {
    return this.graph;
  }

  async search(query: string): Promise<Person[]> {
    const q = query.toLowerCase();
    return this.graph.persons.filter((person) =>
      [...person.givenNames, person.familyName ?? '', person.displayName ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }
}
