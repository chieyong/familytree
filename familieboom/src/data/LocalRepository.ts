import type { FamilyRepository } from './FamilyRepository';
import type { FamilyGraph, Person, PersonID } from './types';
import { FixtureRepository } from './FixtureRepository';
import { demoFamily } from './fixtures/demoFamily';

/**
 * Lokale datalaag voor de offline desktop-app (Tauri) — single-user, geen cloud,
 * geen RLS. De data blijft op de pc van de gebruiker.
 *
 * FASE 1 (nu): placeholder die de demo-familie teruggeeft, zodat de desktop-schil
 * en de backend-schakelaar werken en de app in een Tauri-venster opstart.
 *
 * FASE 2 (volgende): vervang de binnenkant door SQLite (tauri-plugin-sql) met een
 * client-side `_build_graph`-equivalent en persistente writes. De UI verandert
 * niet — die kent alleen dit `FamilyRepository`-contract; de schrijfkant komt
 * achter een parallelle write-interface.
 */
export class LocalRepository implements FamilyRepository {
  private inner = new FixtureRepository(demoFamily as FamilyGraph);

  getPerson(id: PersonID): Promise<Person | undefined> {
    return this.inner.getPerson(id);
  }
  getEgoGraph(id: PersonID, depth: number): Promise<FamilyGraph> {
    return this.inner.getEgoGraph(id, depth);
  }
  getFullGraph(): Promise<FamilyGraph> {
    return this.inner.getFullGraph();
  }
  search(query: string): Promise<Person[]> {
    return this.inner.search(query);
  }
}
