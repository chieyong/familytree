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

describe('KinshipService.generations — voorouder-nakomeling-huwelijken', () => {
  it('laat een neergaande huwelijkslus de generaties niet wegpompen', () => {
    // Y is ouder van X1 én getrouwd met X1's kleinkind X3: "partners gelijke
    // hoogte" en "kind strikt onder ouder" zijn dan onderling strijdig (zoals
    // in de Habsburg-import). De unie wordt opgespoord en overgeslagen bij het
    // gelijktrekken; de ouder-keten blijft daardoor gewoon strikt neerwaarts.
    const graph: FamilyGraph = {
      persons: ['x0', 'x1', 'x2', 'x3', 'y'].map(person),
      unions: [union('y', 'x3')],
      parentLinks: [
        parentLink('x0', 'x1'),
        parentLink('x1', 'x2'),
        parentLink('x2', 'x3'),
        parentLink('y', 'x1'),
      ],
    };
    const gen = new KinshipService(graph).generations();
    const g = (id: PersonID) => gen.get(id) ?? 0;
    expect(g('x1')).toBeGreaterThan(g('x0'));
    expect(g('x2')).toBeGreaterThan(g('x1'));
    expect(g('x3')).toBeGreaterThan(g('x2'));
    // Geen weggelopen offset: alles binnen de echte boomdiepte, vanaf 0.
    const values = [...gen.values()];
    expect(Math.min(...values)).toBe(0);
    expect(Math.max(...values)).toBeLessThanOrEqual(4);
  });

  it('houdt een schone tak intact als elders in dezelfde familie zo’n huwelijk voorkomt', () => {
    // Bug-melding: in een uitgebreide familie met drie zussen (elk getrouwd,
    // elk twee kinderen) stond één kleinkind (naast haar eigen broer/zus, met
    // exact dezelfde twee ouders) in de verkeerde rij — zodra ergens ELDERS
    // in diezelfde samenhangende familie een voorouder-nakomeling-huwelijk
    // zat. De oude aanpak (hele "nog bewegende" component in bulk terug-
    // schuiven) kon zo'n op zichzelf correcte tak meesleuren. Met gerichte
    // detectie blijven broer én zus, ondanks identieke ouders, aan elkaar
    // gelijk — ongeacht wat er verderop in de familie fout zit.
    const graph: FamilyGraph = {
      persons: ['ouderA', 'ouderB', 'broer', 'zus', 'x0', 'x1', 'x2', 'x3', 'y'].map(person),
      unions: [union('ouderA', 'ouderB'), union('y', 'x3')],
      parentLinks: [
        parentLink('ouderA', 'broer'),
        parentLink('ouderB', 'broer'),
        parentLink('ouderA', 'zus'),
        parentLink('ouderB', 'zus'),
        parentLink('x0', 'x1'),
        parentLink('x1', 'x2'),
        parentLink('x2', 'x3'),
        parentLink('y', 'x1'),
      ],
    };
    const gen = new KinshipService(graph).generations();
    // Broer en zus hebben identieke ouders → moeten identieke generatie hebben,
    // ongeacht de compleet ongerelateerde x-keten elders in dezelfde graaf.
    expect(gen.get('broer')).toBe(gen.get('zus'));
    expect(gen.get('broer')).toBe((gen.get('ouderA') ?? 0) + 1);
  });

  it('convergeert ook bij een oom-nicht-huwelijk (generatie-scheve unie)', () => {
    // Zoals bij de Habsburgers echt voorkwam (Filips II x zijn nicht Anna van
    // Oostenrijk): geen directe voorouder-relatie tussen de partners, maar via
    // hun gedeelde familie ontstaat toch een generatie-conflict. Moet ergens
    // convergeren (niet oneindig wegdrijven), ongeacht welke kant "wint".
    const graph: FamilyGraph = {
      persons: ['opa', 'oom', 'zus', 'nicht', 'oomKind'].map(person),
      unions: [union('oom', 'nicht')],
      parentLinks: [
        parentLink('opa', 'oom'),
        parentLink('opa', 'zus'),
        parentLink('zus', 'nicht'),
        parentLink('oom', 'oomKind'),
      ],
    };
    const gen = new KinshipService(graph).generations();
    const g = (id: PersonID) => gen.get(id) ?? 0;
    expect(g('oom')).toBeGreaterThan(g('opa'));
    expect(g('zus')).toBeGreaterThan(g('opa'));
    expect(g('nicht')).toBeGreaterThan(g('zus'));
    expect(g('oomKind')).toBeGreaterThan(g('oom'));
    expect(Math.max(...gen.values())).toBeLessThanOrEqual(4);
  });

  it('sleept een schone tak niet mee bij een indirecte (niet-voorouder) conflict-unie', () => {
    // Variant op de "schone tak"-test hierboven, maar nu met een oom-nicht-
    // stijl conflict (geen directe voorouder-relatie tussen de partners) i.p.v.
    // een letterlijke voorouder-nakomeling-unie. Broer/zus met identieke ouders
    // horen ook dan gewoon gelijk te blijven.
    const graph: FamilyGraph = {
      persons: ['ouderA', 'ouderB', 'broer', 'zus', 'opa', 'oom', 'ozus', 'nicht', 'oomKind'].map(person),
      unions: [union('ouderA', 'ouderB'), union('oom', 'nicht')],
      parentLinks: [
        parentLink('ouderA', 'broer'),
        parentLink('ouderB', 'broer'),
        parentLink('ouderA', 'zus'),
        parentLink('ouderB', 'zus'),
        parentLink('opa', 'oom'),
        parentLink('opa', 'ozus'),
        parentLink('ozus', 'nicht'),
        parentLink('oom', 'oomKind'),
      ],
    };
    const gen = new KinshipService(graph).generations();
    expect(gen.get('broer')).toBe(gen.get('zus'));
    expect(gen.get('broer')).toBe((gen.get('ouderA') ?? 0) + 1);
  });
});
