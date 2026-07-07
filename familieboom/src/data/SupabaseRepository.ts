import type { FamilyRepository } from './FamilyRepository';
import type { FamilyGraph, Person, PersonID, ViewAs } from './types';
import { supabase } from './supabaseClient';

const EMPTY: FamilyGraph = { persons: [], unions: [], parentLinks: [] };

/**
 * Echte datalaag op Supabase. Lezen gaat via de RPC's get_full_graph /
 * get_ego_graph (traversal + zichtbaarheid + stubs in de DB); de UI kent
 * alleen FamilyGraph. Eén instantie per familie (boom).
 *
 * Bij een actieve "Bekijk als …"-simulatie (owner-tool) roepen we in plaats
 * daarvan de *_as-varianten aan: die draaien dezelfde RLS-logica server-side,
 * maar met een gesimuleerde rol/persoon. Een nieuwe repository-instantie per
 * viewAs-waarde forceert een herlaadslag (App keyt de useMemo erop).
 */
export class SupabaseRepository implements FamilyRepository {
  private familyId: string;
  private viewAs: ViewAs | null;

  constructor(familyId: string, viewAs: ViewAs | null = null) {
    if (!supabase) throw new Error('Supabase-client ontbreekt (env-vars niet gezet).');
    this.familyId = familyId;
    this.viewAs = viewAs;
  }

  async getFullGraph(): Promise<FamilyGraph> {
    const { data, error } = this.viewAs
      ? await supabase!.rpc('get_full_graph_as', {
          p_family: this.familyId,
          p_role: this.viewAs.role,
          p_person: this.viewAs.personId,
        })
      : await supabase!.rpc('get_full_graph', { p_family: this.familyId });
    if (error) throw error;
    return (data as FamilyGraph | null) ?? EMPTY;
  }

  async getEgoGraph(id: PersonID, depth: number): Promise<FamilyGraph> {
    const { data, error } = this.viewAs
      ? await supabase!.rpc('get_ego_graph_as', {
          p_person: id,
          p_depth: depth,
          p_role: this.viewAs.role,
          p_view_person: this.viewAs.personId,
        })
      : await supabase!.rpc('get_ego_graph', { p_person: id, p_depth: depth });
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
