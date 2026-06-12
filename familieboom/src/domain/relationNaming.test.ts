import { describe, expect, it } from 'vitest';
import type { FamilyGraph } from '../data/types';
import { demoFamily } from '../data/fixtures/demoFamily';
import habsburgJson from '../data/fixtures/habsburg.json';
import { KinshipService } from './kinship';
import { describeRelation } from './relationNaming';

const demo = new KinshipService(demoFamily);
const habsburg = new KinshipService(habsburgJson as unknown as FamilyGraph);

describe('demo-familie, vanuit Lisa', () => {
  const rel = (target: string) => describeRelation(demo, 'lisa', target);

  it('directe lijn', () => {
    expect(rel('anna').label).toBe('moeder');
    expect(rel('peter').label).toBe('vader');
    expect(rel('noor').label).toBe('dochter');
    expect(rel('hendrik').label).toBe('grootvader');
    expect(rel('greet').label).toBe('grootmoeder');
  });

  it('siblings: vol, half en stief', () => {
    expect(rel('daan').label).toBe('broer');
    expect(rel('femke').label).toBe('halfzus');
    expect(rel('sophie').label).toBe('stiefzus');
  });

  it('stiefouders via actuele verbintenis van een ouder', () => {
    expect(rel('tom').label).toBe('stiefvader');
    expect(rel('sandra').label).toBe('stiefmoeder');
  });

  it('adoptie wint van stief bij Daan → Tom', () => {
    expect(describeRelation(demo, 'daan', 'tom').label).toBe('adoptievader');
  });

  it('neef met ontdubbelende pad-ondertitel', () => {
    const bram = rel('bram');
    expect(bram.label).toBe('neef');
    expect(bram.subtitle).toBe('zoon van je oom Kees de Vries');
  });

  it('oom en partner', () => {
    expect(rel('kees').label).toBe('oom');
    expect(rel('jesse').label).toBe('partner'); // samenwonend, geen huwelijk
  });

  it('partner van je oom is een aangetrouwde tante, met leesbare via-zin', () => {
    const ingrid = rel('ingrid');
    expect(ingrid.label).toBe('aangetrouwde tante');
    expect(ingrid.subtitle).toBe('via Anna de Vries, Hendrik de Vries en Kees de Vries');
  });

  it('omgekeerd perspectief: Lisa vanuit Kees is een nicht', () => {
    const lisa = describeRelation(demo, 'kees', 'lisa');
    expect(lisa.label).toBe('nicht');
    expect(lisa.subtitle).toBe('dochter van je zus Anna de Vries');
  });

  it('andere ouder verschijnt bij direct kind', () => {
    const noor = describeRelation(demo, 'jesse', 'noor');
    expect(noor.label).toBe('dochter');
    expect(noor.subtitle).toContain('Lisa Jansen');
  });

  it('ex-partner blijft benoemd', () => {
    expect(describeRelation(demo, 'anna', 'peter').label).toBe('ex-partner');
  });
});

describe('Habsburg, vanuit Keizer Karel V (Q32500)', () => {
  const rel = (target: string) => describeRelation(habsburg, 'Q32500', target);

  it('Isabel is zijn dochter, met Germaine de Foix als andere ouder', () => {
    const isabel = rel('Q938778');
    expect(isabel.label).toBe('dochter');
    expect(isabel.subtitle).toContain('Germaine de Foix');
  });

  it('Filips II is zijn zoon', () => {
    expect(rel('Q34417').label).toBe('zoon');
  });

  it('Ferdinand I is zijn broer', () => {
    expect(rel('Q150611').label).toBe('broer');
  });

  it('Maximiliaan II: schoonzoon is het kortste pad (én neef via Ferdinand)', () => {
    const max = rel('Q150862');
    expect(max.label).toBe('schoonzoon');
  });

  it('zelfverwijzing', () => {
    expect(rel('Q32500').label).toBe('jijzelf');
  });
});
