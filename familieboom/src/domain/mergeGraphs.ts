import type { FamilyGraph, Person, PersonID } from '../data/types';

/**
 * Een familie-graaf met de familie waaruit hij komt. De primaire familie is
 * die van de gebruiker (eigen boom); de secundaire zijn de gekoppelde bomen.
 */
export interface OriginGraph {
  familyId: string;
  graph: FamilyGraph;
}

/**
 * Voegt de primaire familie-boom samen met één of meer gekoppelde bomen tot één
 * doorlopende graaf, "genaaid" op de brugpersonen (person.bridge → dezelfde
 * persoon in een andere familie).
 *
 * Aanpak:
 *  1. Union-find over alle brugparen (a.id ↔ a.bridge.personId). Elke groep
 *     samengevoegde personen krijgt één canoniek id; de persoon uit de primaire
 *     familie wint (zijn data blijft leidend en blijft bewerkbaar), anders de
 *     eerst geziene.
 *  2. Personen ontdubbelen op canoniek id; unions/parentLinks worden met dat id
 *     omgemapt en ontdubbeld.
 *  3. Elke persoon krijgt originFamilyId mee voor het kleuraccent per herkomst.
 *
 * Puur en zonder neveneffecten: de invoergrafen worden niet gemuteerd.
 */
export function mergeGraphs(primary: OriginGraph, others: OriginGraph[]): FamilyGraph {
  const all = [primary, ...others];

  // Herkomst per (oorspronkelijk) persoon-id — vóór het remappen, zodat we het
  // canonieke id straks aan de juiste familie kunnen koppelen.
  const originOf = new Map<PersonID, string>();
  for (const { familyId, graph } of all) {
    for (const p of graph.persons) {
      if (!originOf.has(p.id)) originOf.set(p.id, familyId);
    }
  }

  // Union-find. parent[] wijst naar een representant; primaire ids krijgen
  // voorrang als representant zodat de merged node in de eigen boom blijft.
  const parent = new Map<PersonID, PersonID>();
  const isPrimary = new Set<PersonID>(primary.graph.persons.map((p) => p.id));
  const find = (x: PersonID): PersonID => {
    let r = x;
    while (parent.get(r) && parent.get(r) !== r) r = parent.get(r)!;
    // pad-compressie
    let c = x;
    while (parent.get(c) && parent.get(c) !== r) {
      const next = parent.get(c)!;
      parent.set(c, r);
      c = next;
    }
    return r;
  };
  const ensure = (x: PersonID) => { if (!parent.has(x)) parent.set(x, x); };
  const unite = (a: PersonID, b: PersonID) => {
    ensure(a); ensure(b);
    const ra = find(a), rb = find(b);
    if (ra === rb) return;
    // Primair id wint als representant; anders houdt ra aan.
    if (isPrimary.has(rb) && !isPrimary.has(ra)) parent.set(ra, rb);
    else parent.set(rb, ra);
  };

  for (const { graph } of all) {
    for (const p of graph.persons) {
      ensure(p.id);
      // Koppel alleen als de tegenhanger ook echt in een geladen graaf zit.
      if (p.bridge && originOf.has(p.bridge.personId)) unite(p.id, p.bridge.personId);
    }
  }

  // Ontdubbelen op identiteit: dezelfde persoon komt vaak in beide bomen voor
  // zonder expliciete brug (bv. ooit gekopieerd). Zelfde genormaliseerde naam
  // én zelfde geboortejaar = dezelfde persoon → samenvoegen. Het geboortejaar is
  // vereist zodat we naamgenoten zonder verdere gegevens niet per ongeluk
  // samensmelten; verborgen stubs (geen jaar) blijven dus buiten schot.
  const byIdentity = new Map<string, PersonID[]>();
  for (const { graph } of all) {
    for (const p of graph.persons) {
      const year = p.birth?.date?.year;
      if (p.hidden || year == null) continue;
      const name = (p.displayName || [...p.givenNames, p.familyName ?? ''].join(' '))
        .toLowerCase().replace(/\s+/g, ' ').trim();
      if (!name) continue;
      const key = `${name}|${year}`;
      const group = byIdentity.get(key);
      if (group) group.push(p.id);
      else byIdentity.set(key, [p.id]);
    }
  }
  for (const group of byIdentity.values()) {
    for (let i = 1; i < group.length; i++) unite(group[0], group[i]);
  }

  const canon = (id: PersonID): PersonID => (parent.has(id) ? find(id) : id);

  // Personen: per canoniek id één node. De primaire persoon is leidend; is er
  // geen primaire in de groep, dan de eerst geziene. originFamilyId volgt het
  // canonieke id (dus de familie waar de merged node "thuishoort").
  const byCanon = new Map<PersonID, Person>();
  for (const { graph } of all) {
    for (const p of graph.persons) {
      const cid = canon(p.id);
      const existing = byCanon.get(cid);
      if (!existing || (isPrimary.has(p.id) && existing.id !== cid)) {
        byCanon.set(cid, { ...p, id: cid, originFamilyId: originOf.get(cid) });
      }
    }
  }
  const persons = [...byCanon.values()];

  // Unions ontdubbelen op het gesorteerde canonieke partnerpaar.
  const unionByKey = new Map<string, FamilyGraph['unions'][number]>();
  for (const { graph } of all) {
    for (const u of graph.unions) {
      const a = canon(u.partners[0]);
      const b = canon(u.partners[1]);
      if (a === b) continue; // zou een persoon met zichzelf koppelen
      const key = [a, b].sort().join('|');
      if (!unionByKey.has(key)) unionByKey.set(key, { ...u, partners: [a, b] });
    }
  }
  const unions = [...unionByKey.values()];

  // Parent-links ontdubbelen op (ouder, kind) na remappen.
  const linkByKey = new Map<string, FamilyGraph['parentLinks'][number]>();
  for (const { graph } of all) {
    for (const l of graph.parentLinks) {
      const parentId = canon(l.parent);
      const childId = canon(l.child);
      if (parentId === childId) continue;
      const key = `${parentId}->${childId}`;
      if (!linkByKey.has(key)) linkByKey.set(key, { ...l, parent: parentId, child: childId });
    }
  }
  const parentLinks = [...linkByKey.values()];

  return { persons, unions, parentLinks };
}
