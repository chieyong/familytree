import type { FamilyRepository } from './FamilyRepository';
import type { FamilyGraph, Person, PersonID } from './types';
import { supabase } from './supabaseClient';

const EMPTY: FamilyGraph = { persons: [], unions: [], parentLinks: [] };

/**
 * Echte datalaag op Supabase. Lezen gaat via de RPC's get_full_graph /
 * get_ego_graph (traversal + zichtbaarheid + stubs in de DB); de UI kent
 * alleen FamilyGraph. Eén instantie per familie (boom).
 */
export class SupabaseRepository implements FamilyRepository {
  private familyId: string;

  constructor(familyId: string) {
    if (!supabase) throw new Error('Supabase-client ontbreekt (env-vars niet gezet).');
    this.familyId = familyId;
  }

  async getFullGraph(): Promise<FamilyGraph> {
    const { data, error } = await supabase!.rpc('get_full_graph', { p_family: this.familyId });
    if (error) throw error;
    return (data as FamilyGraph | null) ?? EMPTY;
  }

  async getEgoGraph(id: PersonID, depth: number): Promise<FamilyGraph> {
    const { data, error } = await supabase!.rpc('get_ego_graph', { p_person: id, p_depth: depth });
    if (error) throw error;
    return (data as FamilyGraph | null) ?? EMPTY;
  }

  async getPerson(id: PersonID): Promise<Person | undefined> {
    const graph = await this.getEgoGraph(id, 0);
    return graph.persons.find((person) => person.id === id);
  }

  async search(query: string): Promise<Person[]> {
    const graph = await this.getFullGraph();
    const q = query.toLowerCase();
    return graph.persons.filter((person) =>
      [...person.givenNames, person.familyName ?? '', person.displayName ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }
}
