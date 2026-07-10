import { describe, expect, it } from 'vitest';
import type { FamilyGraph, ParentChildLink, Person, PersonID, Union } from '../data/types';
import { mergeGraphs } from './mergeGraphs';

function person(id: PersonID, bridge?: { familyId: string; personId: string }): Person {
  return {
    id,
    givenNames: [id],
    visibility: 'public',
    bridge: bridge ? { familyId: bridge.familyId, familyName: bridge.familyId, personId: bridge.personId } : undefined,
  };
}
function named(id: PersonID, name: string, year: number): Person {
  return { id, givenNames: name.split(' '), displayName: name, birth: { date: { year } }, visibility: 'public' };
}
function parentLink(parent: PersonID, child: PersonID): ParentChildLink {
  return { id: `${parent}-${child}`, parent, child, role: 'biological', visibility: 'public' };
}
function union(a: PersonID, b: PersonID): Union {
  return { id: `${a}+${b}`, partners: [a, b], type: 'marriage', visibility: 'public' };
}

describe('mergeGraphs', () => {
  it('naait twee bomen op de brugpersoon tot één node en behoudt de primaire data', () => {
    // Familie A: opa a1 → a2 (de brugpersoon). Familie B: b1 (brug) → b2 (kind).
    // a2 en b1 zijn dezelfde persoon.
    const a: FamilyGraph = {
      persons: [person('a1'), person('a2', { familyId: 'B', personId: 'b1' })],
      unions: [],
      parentLinks: [parentLink('a1', 'a2')],
    };
    const b: FamilyGraph = {
      persons: [person('b1', { familyId: 'A', personId: 'a2' }), person('b2')],
      unions: [],
      parentLinks: [parentLink('b1', 'b2')],
    };

    const merged = mergeGraphs({ familyId: 'A', graph: a }, [{ familyId: 'B', graph: b }]);

    // b1 is samengevoegd in a2 → 3 personen i.p.v. 4.
    expect(merged.persons.map((p) => p.id).sort()).toEqual(['a1', 'a2', 'b2']);
    // De brugpersoon houdt het primaire (A-)id en hoort bij familie A.
    const bridgeNode = merged.persons.find((p) => p.id === 'a2')!;
    expect(bridgeNode.originFamilyId).toBe('A');
    // Beide zijden van de relatie hangen nu aan de merged node.
    expect(merged.parentLinks.map((l) => `${l.parent}->${l.child}`).sort()).toEqual(['a1->a2', 'a2->b2']);
    // Herkomst van een puur-B-persoon blijft B.
    expect(merged.persons.find((p) => p.id === 'b2')!.originFamilyId).toBe('B');
  });

  it('ontdubbelt een union die in beide bomen bestaat', () => {
    const a: FamilyGraph = {
      persons: [person('a1', { familyId: 'B', personId: 'b1' }), person('a2', { familyId: 'B', personId: 'b2' })],
      unions: [union('a1', 'a2')],
      parentLinks: [],
    };
    const b: FamilyGraph = {
      persons: [person('b1', { familyId: 'A', personId: 'a1' }), person('b2', { familyId: 'A', personId: 'a2' })],
      unions: [union('b1', 'b2')],
      parentLinks: [],
    };
    const merged = mergeGraphs({ familyId: 'A', graph: a }, [{ familyId: 'B', graph: b }]);
    expect(merged.persons).toHaveLength(2);
    expect(merged.unions).toHaveLength(1);
    expect(merged.unions[0].partners.sort()).toEqual(['a1', 'a2']);
  });

  it('ontdubbelt dezelfde persoon (naam + geboortejaar) zonder expliciete brug', () => {
    const a: FamilyGraph = { persons: [named('a1', 'Buk Sing Lai', 1933)], unions: [], parentLinks: [] };
    const b: FamilyGraph = { persons: [named('b1', 'Buk Sing Lai', 1933), named('b2', 'Buk Sing Lai', 1990)], unions: [], parentLinks: [] };
    const merged = mergeGraphs({ familyId: 'A', graph: a }, [{ familyId: 'B', graph: b }]);
    // a1 en b1 vallen samen (zelfde naam+jaar); b2 (ander jaar) blijft apart.
    expect(merged.persons).toHaveLength(2);
    const bukSing = merged.persons.find((p) => p.birth?.date?.year === 1933)!;
    expect(bukSing.id).toBe('a1'); // primaire familie wint het canonieke id
    expect(bukSing.originFamilyId).toBe('A');
  });

  it('smelt naamgenoten zonder geboortejaar niet samen', () => {
    const a: FamilyGraph = { persons: [{ id: 'a1', givenNames: ['Jan', 'Lai'], displayName: 'Jan Lai', visibility: 'public' }], unions: [], parentLinks: [] };
    const b: FamilyGraph = { persons: [{ id: 'b1', givenNames: ['Jan', 'Lai'], displayName: 'Jan Lai', visibility: 'public' }], unions: [], parentLinks: [] };
    const merged = mergeGraphs({ familyId: 'A', graph: a }, [{ familyId: 'B', graph: b }]);
    expect(merged.persons).toHaveLength(2);
  });

  it('laat een brug naar een niet-geladen familie ongemoeid', () => {
    const a: FamilyGraph = {
      persons: [person('a1', { familyId: 'Z', personId: 'z9' })],
      unions: [],
      parentLinks: [],
    };
    const merged = mergeGraphs({ familyId: 'A', graph: a }, []);
    expect(merged.persons).toHaveLength(1);
    expect(merged.persons[0].id).toBe('a1');
    expect(merged.persons[0].originFamilyId).toBe('A');
  });
});
