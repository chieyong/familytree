import type { FamilyGraph, Person, PersonID } from './types';

/**
 * Enige toegangspoort tot familiedata. Nu een lokale fixture-implementatie,
 * later een echte API — de UI kent alleen dit contract.
 * Het latere privacysysteem dwingt zichtbaarheid hier af, nooit in de UI.
 */
export interface FamilyRepository {
  getPerson(id: PersonID): Promise<Person | undefined>;
  /** Subgraph rond een focuspersoon, voor de ego-centrische navigatieweergave. */
  getEgoGraph(id: PersonID, depth: number): Promise<FamilyGraph>;
  /** Volledige graph, voor de kunstwerk-view (op PoC-schaal acceptabel). */
  getFullGraph(): Promise<FamilyGraph>;
  search(query: string): Promise<Person[]>;
}
