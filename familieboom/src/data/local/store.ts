import type {
  FamilyGraph, Person, Place, ParentRole, UnionEndReason, UnionType,
} from '../types';
import type { NewRelative, PersonEdit, PlaceInput, RelationKind } from '../mutations';
import { demoFamily } from '../fixtures/demoFamily';
import { browserPersistence, type SnapshotStore } from './persistence';

const uuid = (): string => crypto.randomUUID();
const clone = <T>(v: T): T => structuredClone(v);

/** Zet/behoud een jaartal in een geboorte-/sterfte-slot (place blijft staan). */
function withYear(
  slot: { date?: { year: number; month?: number; day?: number }; place?: Place } | undefined,
  year: number | undefined,
): typeof slot {
  const place = slot?.place;
  const date = year != null ? { ...(slot?.date ?? {}), year } : undefined;
  return date || place ? { date, place } : undefined;
}

function toPlace(p: PlaceInput | null | undefined): Place | undefined {
  return p ? { name: p.name, lat: p.lat, lon: p.lon, wikidataId: p.wikidataId } : undefined;
}

/**
 * Lokale, single-user datalaag (offline desktop / browser-local-modus). Houdt de
 * volledige FamilyGraph in geheugen en persisteert 'm bij elke wijziging. Geen
 * zichtbaarheidsmaskering (RLS) — het is je eigen boom op je eigen apparaat.
 *
 * Spiegelt de schrijf-operaties uit `mutations.ts`, maar tegen de lokale graaf.
 */
export class LocalStore {
  private graph: FamilyGraph;
  private persist: SnapshotStore;

  constructor(persist: SnapshotStore, seed?: FamilyGraph) {
    this.persist = persist;
    const loaded = persist.load();
    if (loaded) {
      this.graph = loaded;
    } else {
      this.graph = seed ? clone(seed) : { persons: [], unions: [], parentLinks: [] };
      persist.save(this.graph);
    }
  }

  private commit() { this.persist.save(this.graph); }
  private person(id: string) { return this.graph.persons.find((p) => p.id === id); }
  private union(id: string) { return this.graph.unions.find((u) => u.id === id); }
  private link(id: string) { return this.graph.parentLinks.find((l) => l.id === id); }

  /** Een kloon (React krijgt zo een nieuwe referentie na elke wijziging). */
  getGraph(): FamilyGraph { return clone(this.graph); }

  /** Volledige boom vervangen (import/herstel). */
  replace(graph: FamilyGraph) { this.graph = clone(graph); this.commit(); }

  // ── Personen ──────────────────────────────────────────────────────────────
  updatePerson(id: string, e: PersonEdit) {
    const p = this.person(id);
    if (!p) return;
    p.givenNames = [e.given];
    p.callName = e.callName?.trim() || undefined;
    p.familyName = e.familyName || undefined;
    p.nameNative = e.nameNative || undefined;
    p.nicknames = e.nicknames && e.nicknames.length ? e.nicknames : undefined;
    p.preferredName = e.preferredName && e.preferredName !== 'full' ? e.preferredName : undefined;
    p.sex = e.sex || undefined;
    p.birth = withYear(p.birth, e.birthYear);
    p.death = withYear(p.death, e.deathYear);
    p.visibility = e.visibility;
    this.commit();
  }

  setPersonPlace(id: string, kind: 'birth' | 'death', place: PlaceInput | null) {
    const p = this.person(id);
    if (!p) return;
    const slot = kind === 'birth' ? p.birth : p.death;
    const next = slot?.date || place ? { date: slot?.date, place: toPlace(place) } : undefined;
    if (kind === 'birth') p.birth = next; else p.death = next;
    this.commit();
  }

  deletePerson(id: string) {
    this.graph.persons = this.graph.persons.filter((p) => p.id !== id);
    this.graph.unions = this.graph.unions.filter((u) => u.partners[0] !== id && u.partners[1] !== id);
    this.graph.parentLinks = this.graph.parentLinks.filter((l) => l.parent !== id && l.child !== id);
    this.commit();
  }

  // ── Woonplaatsen ────────────────────────────────────────────────────────────
  addResidence(personId: string, place: PlaceInput, fromYear?: number) {
    const p = this.person(personId);
    if (!p) return;
    p.residences = [
      ...(p.residences ?? []),
      { id: uuid(), place: toPlace(place)!, from: fromYear != null ? { year: fromYear } : undefined },
    ];
    this.commit();
  }

  updateResidence(id: string, fromYear?: number) {
    for (const p of this.graph.persons) {
      const r = p.residences?.find((x) => x.id === id);
      if (r) { r.from = fromYear != null ? { year: fromYear } : undefined; this.commit(); return; }
    }
  }

  removeResidence(id: string) {
    for (const p of this.graph.persons) {
      if (p.residences?.some((x) => x.id === id)) {
        p.residences = p.residences.filter((x) => x.id !== id);
        this.commit();
        return;
      }
    }
  }

  // ── Relaties ────────────────────────────────────────────────────────────────
  addRelative(relation: RelationKind, anchorId: string, rel: NewRelative): string {
    const id = uuid();
    const person: Person = {
      id,
      givenNames: [rel.given],
      familyName: rel.familyName || undefined,
      nameNative: rel.nameNative || undefined,
      callName: rel.callName?.trim() || undefined,
      nicknames: rel.nickname ? [rel.nickname] : undefined,
      sex: rel.sex || undefined,
      birth: rel.birthYear != null ? { date: { year: rel.birthYear } } : undefined,
      death: rel.deathYear != null ? { date: { year: rel.deathYear } } : undefined,
      visibility: 'family',
    };
    this.graph.persons.push(person);
    this.connect(relation, anchorId, id);
    this.commit();
    return id;
  }

  linkRelative(relation: RelationKind, anchorId: string, otherId: string) {
    this.connect(relation, anchorId, otherId);
    this.commit();
  }

  private connect(relation: RelationKind, anchorId: string, otherId: string) {
    if (relation === 'partner') {
      this.graph.unions.push({ id: uuid(), partners: [anchorId, otherId], type: 'marriage', visibility: 'family' });
      return;
    }
    const [parent, child] = relation === 'parent' ? [otherId, anchorId] : [anchorId, otherId];
    this.graph.parentLinks.push({ id: uuid(), parent, child, role: 'biological', visibility: 'family' });
  }

  setUnionType(id: string, type: UnionType) { const u = this.union(id); if (u) { u.type = type; this.commit(); } }
  setUnionStart(id: string, year?: number) { const u = this.union(id); if (u) { u.start = year != null ? { year } : undefined; this.commit(); } }
  setUnionEnd(id: string, reason: UnionEndReason | null, year?: number) {
    const u = this.union(id);
    if (u) { u.end = reason ? { date: year != null ? { year } : undefined, reason } : undefined; this.commit(); }
  }
  deleteUnion(id: string) { this.graph.unions = this.graph.unions.filter((u) => u.id !== id); this.commit(); }

  setParentRole(id: string, role: ParentRole) { const l = this.link(id); if (l) { l.role = role; this.commit(); } }
  deleteParentLink(id: string) { this.graph.parentLinks = this.graph.parentLinks.filter((l) => l.id !== id); this.commit(); }
}

/** Gedeelde instantie voor de app (browser-localStorage / Tauri-webview), geseed
 *  met de demo op de eerste run. Lazy: alleen aangemaakt zodra de lokale modus
 *  'm echt gebruikt (zo raakt localStorage van cloud-gebruikers niet). Tests maken
 *  hun eigen store met memoryPersistence. */
let shared: LocalStore | null = null;
export function getLocalStore(): LocalStore {
  if (!shared) shared = new LocalStore(browserPersistence(), demoFamily as FamilyGraph);
  return shared;
}
