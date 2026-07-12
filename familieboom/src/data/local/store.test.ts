import { describe, expect, it } from 'vitest';
import type { FamilyGraph } from '../types';
import { LocalStore } from './store';
import { memoryPersistence } from './persistence';

const seed: FamilyGraph = {
  persons: [
    { id: 'a', givenNames: ['Jan'], familyName: 'Lai', visibility: 'family' },
    { id: 'b', givenNames: ['Mei'], familyName: 'Lai', visibility: 'family' },
  ],
  unions: [{ id: 'u1', partners: ['a', 'b'], type: 'marriage', visibility: 'family' }],
  parentLinks: [],
};

function store(initial: FamilyGraph = seed) {
  return new LocalStore(memoryPersistence(), initial);
}

describe('LocalStore', () => {
  it('werkt een persoon bij (naam, bijnamen, jaar) en behoudt de plaats', () => {
    const s = store({
      persons: [{ id: 'a', givenNames: ['Jan'], visibility: 'family', birth: { place: { name: 'Vught' } } }],
      unions: [], parentLinks: [],
    });
    s.updatePerson('a', { given: 'Jan Piet', nicknames: ['Jantje'], birthYear: 1940, visibility: 'private' });
    const p = s.getGraph().persons[0];
    expect(p.givenNames).toEqual(['Jan Piet']);
    expect(p.nicknames).toEqual(['Jantje']);
    expect(p.birth?.date?.year).toBe(1940);
    expect(p.birth?.place?.name).toBe('Vught'); // plaats blijft
    expect(p.visibility).toBe('private');
  });

  it('voegt woonplaatsen toe, werkt het jaar bij en verwijdert', () => {
    const s = store();
    s.addResidence('a', { name: 'Amsterdam', lat: 52.3, lon: 4.9 }, 2000);
    let a = s.getGraph().persons.find((p) => p.id === 'a')!;
    const rid = a.residences![0].id!;
    expect(a.residences).toHaveLength(1);
    expect(a.residences![0].from?.year).toBe(2000);
    s.updateResidence(rid, 2005);
    a = s.getGraph().persons.find((p) => p.id === 'a')!;
    expect(a.residences![0].from?.year).toBe(2005);
    s.removeResidence(rid);
    a = s.getGraph().persons.find((p) => p.id === 'a')!;
    expect(a.residences).toHaveLength(0);
  });

  it('voegt een relatie + nieuwe persoon toe (kind → parentLink)', () => {
    const s = store();
    const kid = s.addRelative('child', 'a', { given: 'Lisa', birthYear: 1970 });
    const g = s.getGraph();
    expect(g.persons.some((p) => p.id === kid && p.givenNames[0] === 'Lisa')).toBe(true);
    expect(g.parentLinks).toContainEqual(expect.objectContaining({ parent: 'a', child: kid, role: 'biological' }));
  });

  it('verwijdert een persoon inclusief zijn relaties', () => {
    const s = store();
    s.deletePerson('a');
    const g = s.getGraph();
    expect(g.persons.map((p) => p.id)).toEqual(['b']);
    expect(g.unions).toHaveLength(0); // union a+b weg
  });

  it('persisteert naar de snapshot-store (herladen geeft dezelfde data)', () => {
    const persist = memoryPersistence();
    const s1 = new LocalStore(persist, seed);
    s1.addRelative('partner', 'a', { given: 'Nieuw' });
    const s2 = new LocalStore(persist); // herlaadt uit dezelfde persistence
    expect(s2.getGraph().persons.some((p) => p.givenNames[0] === 'Nieuw')).toBe(true);
  });

  it('seedt de persistence op de eerste run', () => {
    const persist = memoryPersistence();
    new LocalStore(persist, seed);
    expect(persist.load()?.persons).toHaveLength(2);
  });

  it('zet en wist een profielfoto (data-URL)', () => {
    const s = store();
    s.setPhoto('a', 'data:image/png;base64,AAA');
    expect(s.getGraph().persons.find((p) => p.id === 'a')?.photoPath).toBe('data:image/png;base64,AAA');
    s.setPhoto('a', null);
    expect(s.getGraph().persons.find((p) => p.id === 'a')?.photoPath).toBeUndefined();
  });

  it('vervangt de hele boom (back-up herstellen / nieuwe boom) en persisteert', () => {
    const persist = memoryPersistence(seed);
    const s = new LocalStore(persist);
    s.replace({ persons: [{ id: 'x', givenNames: ['Ik'], visibility: 'family' }], unions: [], parentLinks: [] });
    expect(s.getGraph().persons.map((p) => p.id)).toEqual(['x']);
    expect(persist.load()?.persons).toHaveLength(1);
  });
});
