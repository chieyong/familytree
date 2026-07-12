import type { FamilyGraph } from '../types';

/**
 * Persistentie voor de lokale (offline) datalaag. De volledige FamilyGraph is
 * tegelijk het opslagformaat — klein genoeg voor een familieboom, en de opslag
 * is meteen de back-up. Nu localStorage (werkt in de browser én de Tauri-webview);
 * een echt bestand op schijf (Tauri fs) is later een kleine swap achter dit
 * contract.
 */
export interface SnapshotStore {
  load(): FamilyGraph | null;
  save(graph: FamilyGraph): void;
}

const KEY = 'familieboom.local.v1';

/** localStorage-implementatie; valt terug op geheugen als localStorage ontbreekt
 *  (bv. in unit-tests onder Node). */
export function browserPersistence(): SnapshotStore {
  if (typeof localStorage === 'undefined') return memoryPersistence();
  return {
    load() {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as FamilyGraph;
      } catch {
        return null;
      }
    },
    save(graph) {
      localStorage.setItem(KEY, JSON.stringify(graph));
    },
  };
}

/** In-memory-implementatie voor tests. */
export function memoryPersistence(initial: FamilyGraph | null = null): SnapshotStore {
  let snapshot = initial;
  return {
    load: () => snapshot,
    save: (graph) => { snapshot = graph; },
  };
}
