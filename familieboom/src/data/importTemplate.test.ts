import { describe, expect, it } from 'vitest';
import type { FamilyGraph, Person } from './types';
import { exportFamilyCsv, parseTemplate } from './importTemplate';

function person(id: string, extra: Partial<Person> = {}): Person {
  return { id, givenNames: [id], visibility: 'family', ...extra };
}

const graph: FamilyGraph = {
  persons: [
    person('pa', { givenNames: ['Jan'], familyName: 'Lai', sex: 'm', birth: { date: { year: 1940 } } }),
    person('ma', { givenNames: ['Mei'], familyName: 'Lai', sex: 'f', birth: { date: { year: 1942 } } }),
    person('kid', {
      givenNames: ['Chie', 'Yong'], familyName: 'Lai', sex: 'm',
      nicknames: ['David', 'Dave'], callName: 'Chie',
      birth: { date: { year: 1980 }, place: { name: 'Vught' } },
      residences: [{ place: { name: 'Amsterdam' }, from: { year: 2000 } }],
    }),
  ],
  unions: [{ id: 'u1', partners: ['pa', 'ma'], type: 'marriage', visibility: 'family' }],
  parentLinks: [
    { id: 'l1', parent: 'pa', child: 'kid', role: 'biological', visibility: 'family' },
    { id: 'l2', parent: 'ma', child: 'kid', role: 'biological', visibility: 'family' },
  ],
};

describe('exportFamilyCsv', () => {
  it('gebruikt leesbare sleutels en zet ouders op geslacht als vader/moeder', () => {
    const csv = exportFamilyCsv(graph);
    const lines = csv.split('\n');
    const header = lines[0].split(',');
    const kid = lines[3].split(',');
    const col = (name: string) => kid[header.indexOf(name)];
    expect(col('id')).toBe('chie-yong-lai-1980');
    expect(col('voornaam')).toBe('Chie Yong');
    expect(col('bijnaam')).toBe('David | Dave');
    expect(col('roepnaam')).toBe('Chie');
    expect(col('geboorteplaats')).toBe('Vught');
    expect(col('woonplaatsen')).toBe('Amsterdam (2000)');
    expect(col('vader_id')).toBe('jan-lai-1940');
    expect(col('moeder_id')).toBe('mei-lai-1942');
  });

  it('partner_id verwijst wederzijds via de sleutels', () => {
    const lines = exportFamilyCsv(graph).split('\n');
    const header = lines[0].split(',');
    const pi = header.indexOf('partner_id');
    expect(lines[1].split(',')[pi]).toBe('mei-lai-1942'); // Jan → Mei
    expect(lines[2].split(',')[pi]).toBe('jan-lai-1940'); // Mei → Jan
  });

  it('lost sleutel-botsingen op met plaats, anders een teller', () => {
    const dup: FamilyGraph = {
      persons: [
        person('a', { givenNames: ['Jan'], familyName: 'Lai', birth: { date: { year: 1940 } } }),
        person('b', { givenNames: ['Jan'], familyName: 'Lai', birth: { date: { year: 1940 }, place: { name: 'Vught' } } }),
        person('c', { givenNames: ['Jan'], familyName: 'Lai', birth: { date: { year: 1940 } } }),
      ],
      unions: [], parentLinks: [],
    };
    const lines = exportFamilyCsv(dup).split('\n');
    const idIdx = lines[0].split(',').indexOf('id');
    const ids = lines.slice(1).map((l) => l.split(',')[idIdx]);
    expect(ids[0]).toBe('jan-lai-1940');
    expect(ids[1]).toBe('jan-lai-1940-vught'); // botsing mét plaats → plaats erbij
    expect(ids[2]).toBe('jan-lai-1940-2');     // botsing zonder plaats → teller
  });

  it('schrijft de echte database-id in db_id (voor herkenning bij re-import)', () => {
    const lines = exportFamilyCsv(graph).split('\n');
    const header = lines[0].split(',');
    const di = header.indexOf('db_id');
    expect(lines[3].split(',')[di]).toBe('kid'); // = person.id
  });
});

describe('parseTemplate — re-import', () => {
  it('markeert db_id-rijen als bestaand (dbId gezet) en nieuwe rijen zonder dbId', () => {
    const parsed = parseTemplate(exportFamilyCsv(graph));
    expect(parsed.errors).toEqual([]);
    // Alle rijen komen mee (bestaande worden bijgewerkt), elk met hun dbId.
    expect(parsed.data.persons).toHaveLength(3);
    expect(parsed.data.persons.every((p) => p.dbId)).toBe(true);
    expect(parsed.data.persons.find((p) => p.key === 'chie-yong-lai-1980')?.dbId).toBe('kid');
    expect(parsed.data.parentLinks).toContainEqual({ parent: 'jan-lai-1940', child: 'chie-yong-lai-1980' });
  });

  it('onderscheidt bestaande (db_id) van nieuwe (lege db_id) personen', () => {
    const csv = [
      'db_id,id,voornaam,geboorte,vader_id',
      'kid,chie-yong-lai-1980,Chie,1980,',            // bestaand (db_id gevuld)
      ',lisa-lai-2015,Lisa,2015,chie-yong-lai-1980',  // nieuw (db_id leeg)
    ].join('\n');
    const parsed = parseTemplate(csv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.data.persons.find((p) => p.key === 'chie-yong-lai-1980')?.dbId).toBe('kid');
    expect(parsed.data.persons.find((p) => p.key === 'lisa-lai-2015')?.dbId).toBeUndefined();
    expect(parsed.data.parentLinks).toContainEqual({ parent: 'chie-yong-lai-1980', child: 'lisa-lai-2015' });
  });

  it('leest de rijke velden van een nieuwe rij (geen db_id)', () => {
    const csv = [
      'id,voornaam,bijnaam,roepnaam,zichtbaarheid,geboorteplaats,woonplaatsen',
      'x,Chie,David | Dave,Chie,private,Vught,Amsterdam (2000); Rotterdam',
    ].join('\n');
    const p = parseTemplate(csv).data.persons[0];
    expect(p.nicknames).toEqual(['David', 'Dave']);
    expect(p.callName).toBe('Chie');
    expect(p.visibility).toBe('private');
    expect(p.birthPlace).toBe('Vught');
    expect(p.residences).toEqual([{ name: 'Amsterdam', fromYear: 2000 }, { name: 'Rotterdam' }]);
  });
});
