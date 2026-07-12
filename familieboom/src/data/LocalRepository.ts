import type { FamilyRepository } from './FamilyRepository';
import type { FamilyGraph, Person, PersonID } from './types';
import { FixtureRepository } from './FixtureRepository';
import { getLocalStore } from './local/store';

/**
 * Lokale datalaag voor de offline desktop-app (Tauri) én de browser-local-modus
 * (`?backend=local`) — single-user, geen cloud, geen RLS. De data blijft op het
 * apparaat (localStorage; later een bestand via Tauri fs).
 *
 * Lezen loopt over de live `LocalStore`-graaf; de BFS voor de ego-weergave
 * hergebruikt de (geteste) FixtureRepository op een momentopname. Schrijven gaat
 * via `mutations.ts`, dat in lokale modus naar dezelfde `LocalStore` dispatcht.
 */
export class LocalRepository implements FamilyRepository {
  private snapshot(): FamilyRepository {
    return new FixtureRepository(getLocalStore().getGraph());
  }

  getPerson(id: PersonID): Promise<Person | undefined> {
    return this.snapshot().getPerson(id);
  }
  getEgoGraph(id: PersonID, depth: number): Promise<FamilyGraph> {
    return this.snapshot().getEgoGraph(id, depth);
  }
  getFullGraph(): Promise<FamilyGraph> {
    return Promise.resolve(getLocalStore().getGraph());
  }
  search(query: string): Promise<Person[]> {
    return this.snapshot().search(query);
  }
}
