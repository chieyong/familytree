import type { FamilyGraph, Person } from '../types';

/**
 * Fictieve familie, bewust complex als stress-test voor de relatie-encoding:
 * - Willem: gescheiden van Greet, hertrouwd met Els → Marco is halfbroer van Peter
 * - Anna & Peter: gescheiden; Anna hertrouwd met Tom (stiefvader van Lisa & Daan)
 * - Tom heeft Daan geadopteerd → Daan heeft bio-vader én adoptievader
 * - Femke (Peter & Sandra) is halfzus van Lisa & Daan
 * - Sophie (Tom & Karin) is stiefzus van Lisa & Daan
 */

const p = (
  id: string,
  givenNames: string[],
  familyName: string,
  sex: 'm' | 'f',
  birthYear: number,
  birthPlace?: { name: string; lat?: number; lon?: number },
  deathYear?: number,
): Person => ({
  id,
  givenNames,
  familyName,
  sex,
  birth: { date: { year: birthYear }, place: birthPlace },
  ...(deathYear ? { death: { date: { year: deathYear } } } : {}),
  visibility: 'family',
});

export const demoFamily: FamilyGraph = {
  persons: [
    // Generatie 0
    p('hendrik', ['Hendrik'], 'de Vries', 'm', 1932, { name: 'Rotterdam', lat: 51.92, lon: 4.48 }, 2001),
    p('johanna', ['Johanna'], 'Bakker', 'f', 1935, { name: 'Delft', lat: 52.01, lon: 4.36 }, 2020),
    p('willem', ['Willem'], 'Jansen', 'm', 1938, { name: 'Utrecht', lat: 52.09, lon: 5.12 }, 2010),
    p('greet', ['Greet'], 'Smit', 'f', 1940, { name: 'Amersfoort', lat: 52.16, lon: 5.39 }),
    p('els', ['Els'], 'van Dam', 'f', 1945, { name: 'Zwolle', lat: 52.51, lon: 6.09 }),
    // Generatie 1
    p('kees', ['Kees'], 'de Vries', 'm', 1958, { name: 'Rotterdam', lat: 51.92, lon: 4.48 }),
    p('ingrid', ['Ingrid'], 'Boer', 'f', 1960, { name: 'Gouda', lat: 52.01, lon: 4.71 }),
    p('anna', ['Anna'], 'de Vries', 'f', 1961, { name: 'Rotterdam', lat: 51.92, lon: 4.48 }),
    p('peter', ['Peter'], 'Jansen', 'm', 1963, { name: 'Utrecht', lat: 52.09, lon: 5.12 }),
    p('marco', ['Marco'], 'Jansen', 'm', 1980, { name: 'Utrecht', lat: 52.09, lon: 5.12 }),
    p('tom', ['Tom'], 'Visser', 'm', 1959, { name: 'Den Haag', lat: 52.08, lon: 4.31 }),
    p('karin', ['Karin'], 'Meijer', 'f', 1962, { name: 'Leiden', lat: 52.16, lon: 4.49 }),
    p('sandra', ['Sandra'], 'Mulder', 'f', 1970, { name: 'Arnhem', lat: 51.98, lon: 5.91 }),
    // Generatie 2
    p('bram', ['Bram'], 'de Vries', 'm', 1989, { name: 'Rotterdam', lat: 51.92, lon: 4.48 }),
    p('eva', ['Eva'], 'Smits', 'f', 1990, { name: 'Breda', lat: 51.59, lon: 4.78 }),
    p('lisa', ['Lisa'], 'Jansen', 'f', 1990, { name: 'Utrecht', lat: 52.09, lon: 5.12 }),
    p('daan', ['Daan'], 'Jansen', 'm', 1993, { name: 'Utrecht', lat: 52.09, lon: 5.12 }),
    p('sophie', ['Sophie'], 'Visser', 'f', 1992, { name: 'Den Haag', lat: 52.08, lon: 4.31 }),
    p('femke', ['Femke'], 'Jansen', 'f', 2007, { name: 'Amersfoort', lat: 52.16, lon: 5.39 }),
    p('jesse', ['Jesse'], 'de Wit', 'm', 1988, { name: 'Amsterdam', lat: 52.37, lon: 4.9 }),
    // Generatie 3
    p('noor', ['Noor'], 'de Wit', 'f', 2019, { name: 'Amsterdam', lat: 52.37, lon: 4.9 }),
    p('mila', ['Mila'], 'de Vries', 'f', 2018, { name: 'Rotterdam', lat: 51.92, lon: 4.48 }),
  ],

  unions: [
    { id: 'u-hendrik-johanna', partners: ['hendrik', 'johanna'], type: 'marriage', start: { year: 1956 }, end: { date: { year: 2001 }, reason: 'death' }, visibility: 'family' },
    { id: 'u-willem-greet', partners: ['willem', 'greet'], type: 'marriage', start: { year: 1962 }, end: { date: { year: 1975 }, reason: 'divorce' }, visibility: 'family' },
    { id: 'u-willem-els', partners: ['willem', 'els'], type: 'marriage', start: { year: 1978 }, end: { date: { year: 2010 }, reason: 'death' }, visibility: 'family' },
    { id: 'u-kees-ingrid', partners: ['kees', 'ingrid'], type: 'marriage', start: { year: 1985 }, visibility: 'family' },
    { id: 'u-anna-peter', partners: ['anna', 'peter'], type: 'marriage', start: { year: 1988 }, end: { date: { year: 2003 }, reason: 'divorce' }, visibility: 'family' },
    { id: 'u-anna-tom', partners: ['anna', 'tom'], type: 'marriage', start: { year: 2006 }, visibility: 'family' },
    { id: 'u-tom-karin', partners: ['tom', 'karin'], type: 'marriage', start: { year: 1985 }, end: { date: { year: 2001 }, reason: 'divorce' }, visibility: 'family' },
    { id: 'u-peter-sandra', partners: ['peter', 'sandra'], type: 'cohabitation', start: { year: 2005 }, visibility: 'family' },
    { id: 'u-lisa-jesse', partners: ['lisa', 'jesse'], type: 'cohabitation', start: { year: 2015 }, visibility: 'family' },
    { id: 'u-bram-eva', partners: ['bram', 'eva'], type: 'marriage', start: { year: 2016 }, visibility: 'family' },
  ],

  // Eerste link per kind = naamgevende ouder (bepaalt o.a. branch-kleur).
  parentLinks: [
    { id: 'pl-1', parent: 'hendrik', child: 'kees', role: 'biological', unionId: 'u-hendrik-johanna', visibility: 'family' },
    { id: 'pl-2', parent: 'johanna', child: 'kees', role: 'biological', unionId: 'u-hendrik-johanna', visibility: 'family' },
    { id: 'pl-3', parent: 'hendrik', child: 'anna', role: 'biological', unionId: 'u-hendrik-johanna', visibility: 'family' },
    { id: 'pl-4', parent: 'johanna', child: 'anna', role: 'biological', unionId: 'u-hendrik-johanna', visibility: 'family' },
    { id: 'pl-5', parent: 'willem', child: 'peter', role: 'biological', unionId: 'u-willem-greet', visibility: 'family' },
    { id: 'pl-6', parent: 'greet', child: 'peter', role: 'biological', unionId: 'u-willem-greet', visibility: 'family' },
    { id: 'pl-7', parent: 'willem', child: 'marco', role: 'biological', unionId: 'u-willem-els', visibility: 'family' },
    { id: 'pl-8', parent: 'els', child: 'marco', role: 'biological', unionId: 'u-willem-els', visibility: 'family' },
    { id: 'pl-9', parent: 'kees', child: 'bram', role: 'biological', unionId: 'u-kees-ingrid', visibility: 'family' },
    { id: 'pl-10', parent: 'ingrid', child: 'bram', role: 'biological', unionId: 'u-kees-ingrid', visibility: 'family' },
    { id: 'pl-11', parent: 'peter', child: 'lisa', role: 'biological', unionId: 'u-anna-peter', visibility: 'family' },
    { id: 'pl-12', parent: 'anna', child: 'lisa', role: 'biological', unionId: 'u-anna-peter', visibility: 'family' },
    { id: 'pl-13', parent: 'peter', child: 'daan', role: 'biological', unionId: 'u-anna-peter', visibility: 'family' },
    { id: 'pl-14', parent: 'anna', child: 'daan', role: 'biological', unionId: 'u-anna-peter', visibility: 'family' },
    { id: 'pl-15', parent: 'tom', child: 'daan', role: 'adoptive', start: { year: 2008 }, visibility: 'family' },
    { id: 'pl-16', parent: 'tom', child: 'sophie', role: 'biological', unionId: 'u-tom-karin', visibility: 'family' },
    { id: 'pl-17', parent: 'karin', child: 'sophie', role: 'biological', unionId: 'u-tom-karin', visibility: 'family' },
    { id: 'pl-18', parent: 'peter', child: 'femke', role: 'biological', unionId: 'u-peter-sandra', visibility: 'family' },
    { id: 'pl-19', parent: 'sandra', child: 'femke', role: 'biological', unionId: 'u-peter-sandra', visibility: 'family' },
    { id: 'pl-20', parent: 'jesse', child: 'noor', role: 'biological', unionId: 'u-lisa-jesse', visibility: 'family' },
    { id: 'pl-21', parent: 'lisa', child: 'noor', role: 'biological', unionId: 'u-lisa-jesse', visibility: 'family' },
    { id: 'pl-22', parent: 'bram', child: 'mila', role: 'biological', unionId: 'u-bram-eva', visibility: 'family' },
    { id: 'pl-23', parent: 'eva', child: 'mila', role: 'biological', unionId: 'u-bram-eva', visibility: 'family' },
  ],
};
