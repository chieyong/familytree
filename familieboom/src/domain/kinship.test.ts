import { describe, expect, it } from 'vitest';
import type { FamilyGraph, ParentChildLink, Person, PersonID, Union } from '../data/types';
import { KinshipService } from './kinship';

function person(id: PersonID): Person {
  return { id, givenNames: [id], visibility: 'public' };
}

function parentLink(parent: PersonID, child: PersonID): ParentChildLink {
  return { id: `${parent}-${child}`, parent, child, role: 'biological', visibility: 'public' };
}

function union(a: PersonID, b: PersonID): Union {
  return { id: `${a}+${b}`, partners: [a, b], type: 'marriage', visibility: 'public' };
}

describe('KinshipService.generations', () => {
  it('lijnt de enige ouder van een partner uit met de eigen ouders, niet met de grootouder', () => {
    // Scenario uit de bug-melding:
    //   ego ← vader, moeder (een koppel)
    //   vader ← opa
    //   partner (getrouwd met ego) ← schoonouder (enkele ouder, geen koppel)
    const graph: FamilyGraph = {
      persons: ['ego', 'vader', 'moeder', 'opa', 'partner', 'schoonouder'].map(person),
      unions: [union('vader', 'moeder'), union('ego', 'partner')],
      parentLinks: [
        parentLink('vader', 'ego'),
        parentLink('moeder', 'ego'),
        parentLink('opa', 'vader'),
        parentLink('schoonouder', 'partner'),
      ],
    };

    const gen = new KinshipService(graph).generations();
    const rel = (id: PersonID) => (gen.get(id) ?? 0) - (gen.get('ego') ?? 0);

    // Ego en partner op gelijke hoogte.
    expect(rel('ego')).toBe(0);
    expect(rel('partner')).toBe(0);
    // Beide eigen ouders één generatie boven ego.
    expect(rel('vader')).toBe(-1);
    expect(rel('moeder')).toBe(-1);
    // De schoonouder hoort NAAST de eigen ouders, niet op opa-hoogte.
    expect(rel('schoonouder')).toBe(-1);
    // Opa staat als enige twee generaties boven ego.
    expect(rel('opa')).toBe(-2);
  });

  it('houdt een diepe voorouderketen één generatie per stap uit elkaar', () => {
    const graph: FamilyGraph = {
      persons: ['kind', 'ouder', 'opa', 'overgrootouder'].map(person),
      unions: [],
      parentLinks: [
        parentLink('ouder', 'kind'),
        parentLink('opa', 'ouder'),
        parentLink('overgrootouder', 'opa'),
      ],
    };
    const gen = new KinshipService(graph).generations();
    expect(gen.get('kind')).toBe(3);
    expect(gen.get('ouder')).toBe(2);
    expect(gen.get('opa')).toBe(1);
    expect(gen.get('overgrootouder')).toBe(0);
  });
});
