import type { FamilyGraph, Person, Residence } from '../types';

/**
 * Internationale demo-familie: een Chinees-Indonesisch/Maleisische familie die
 * over drie generaties van Hongkong, Maleisië en Indonesië naar Nederland
 * migreert. Bewust met geboorte-, sterfte- én woonplaatsen verspreid over Azië
 * en Europa, zodat de Atlas (migratie + levensreis) een rijk verhaal vertelt.
 */

type Spot = { name: string; lat?: number; lon?: number };
const live = (place: Spot, fromYear: number): Residence => ({ place, from: { year: fromYear } });

const p = (
  id: string,
  givenNames: string[],
  familyName: string,
  sex: 'm' | 'f',
  birthYear: number,
  birthPlace?: Spot,
  deathYear?: number,
  deathPlace?: Spot,
  residences?: Residence[],
): Person => ({
  id,
  givenNames,
  familyName,
  sex,
  birth: { date: { year: birthYear }, place: birthPlace },
  ...(deathYear ? { death: { date: { year: deathYear }, place: deathPlace } } : {}),
  ...(residences ? { residences } : {}),
  visibility: 'family',
});

// Plaatsen (lon/lat) — Azië en Nederland.
const MEDAN = { name: 'Medan', lat: 3.59, lon: 98.67 };
const JAKARTA = { name: 'Jakarta', lat: -6.21, lon: 106.85 };
const BANDUNG = { name: 'Bandung', lat: -6.91, lon: 107.61 };
const PENANG = { name: 'George Town', lat: 5.41, lon: 100.34 };
const KL = { name: 'Kuala Lumpur', lat: 3.14, lon: 101.69 };
const HONGKONG = { name: 'Hongkong', lat: 22.32, lon: 114.17 };
const GUANGZHOU = { name: 'Guangzhou', lat: 23.13, lon: 113.26 };
const SINGAPORE = { name: 'Singapore', lat: 1.35, lon: 103.82 };
const AMSTERDAM = { name: 'Amsterdam', lat: 52.37, lon: 4.9 };
const DENHAAG = { name: 'Den Haag', lat: 52.08, lon: 4.31 };
const ROTTERDAM = { name: 'Rotterdam', lat: 51.92, lon: 4.48 };
const UTRECHT = { name: 'Utrecht', lat: 52.09, lon: 5.12 };
const DELFT = { name: 'Delft', lat: 52.01, lon: 4.36 };

export const diasporaFamily: FamilyGraph = {
  persons: [
    // Generatie 0 — grootouders in Azië
    p('boen', ['Boen Liong'], 'Tan', 'm', 1938, MEDAN, 2015, DENHAAG, [live(JAKARTA, 1960), live(DENHAAG, 1980)]),
    p('mei', ['Mei Hwa'], 'Lim', 'f', 1942, PENANG, 2020, AMSTERDAM, [live(KL, 1958), live(JAKARTA, 1965), live(AMSTERDAM, 1980)]),
    p('kafai', ['Ka Fai'], 'Wong', 'm', 1940, HONGKONG, 2010, HONGKONG, [live(GUANGZHOU, 1958)]),
    p('siti', ['Siti'], 'Rahayu', 'f', 1945, BANDUNG, undefined, undefined, [live(JAKARTA, 1968), live(ROTTERDAM, 2000)]),

    // Generatie 1 — kinderen, migreren naar Nederland
    p('eric', ['Eric', 'Eng Hong'], 'Tan', 'm', 1968, JAKARTA, undefined, undefined, [live(SINGAPORE, 1990), live(AMSTERDAM, 1995)]),
    p('mira', ['Mira', 'Mei Lan'], 'Tan', 'f', 1971, JAKARTA, undefined, undefined, [live(AMSTERDAM, 1995)]),
    p('linda', ['Linda', 'Siu Ling'], 'Wong', 'f', 1972, HONGKONG, undefined, undefined, [live(SINGAPORE, 1994), live(ROTTERDAM, 1997)]),
    p('david', ['David', 'Ka Ming'], 'Wong', 'm', 1975, HONGKONG, undefined, undefined, [live(AMSTERDAM, 2001)]),
    // Nederlandse partners die introuwen
    p('joost', ['Joost'], 'de Vries', 'm', 1970, UTRECHT),
    p('anouk', ['Anouk'], 'Bakker', 'f', 1978, DELFT),

    // Generatie 2 — kleinkinderen, geboren in Nederland
    p('daniel', ['Daniël', 'Wei'], 'Tan', 'm', 2001, AMSTERDAM),
    p('lisa', ['Lisa', 'Hui'], 'Tan', 'f', 2004, AMSTERDAM),
    p('sterre', ['Sterre'], 'de Vries', 'f', 2003, UTRECHT),
    p('kai', ['Kai', 'Jun'], 'Wong', 'm', 2009, AMSTERDAM),
  ],

  unions: [
    { id: 'u-boen-mei', partners: ['boen', 'mei'], type: 'marriage', start: { year: 1964 }, end: { date: { year: 2015 }, reason: 'death' }, visibility: 'family' },
    { id: 'u-kafai-siti', partners: ['kafai', 'siti'], type: 'marriage', start: { year: 1968 }, end: { date: { year: 2010 }, reason: 'death' }, visibility: 'family' },
    { id: 'u-eric-linda', partners: ['eric', 'linda'], type: 'marriage', start: { year: 1998 }, visibility: 'family' },
    { id: 'u-mira-joost', partners: ['mira', 'joost'], type: 'marriage', start: { year: 2000 }, visibility: 'family' },
    { id: 'u-david-anouk', partners: ['david', 'anouk'], type: 'marriage', start: { year: 2005 }, visibility: 'family' },
  ],

  // Eerste link per kind = naamgevende ouder (bepaalt o.a. de tak-kleur).
  parentLinks: [
    { id: 'pl-1', parent: 'boen', child: 'eric', role: 'biological', unionId: 'u-boen-mei', visibility: 'family' },
    { id: 'pl-2', parent: 'mei', child: 'eric', role: 'biological', unionId: 'u-boen-mei', visibility: 'family' },
    { id: 'pl-3', parent: 'boen', child: 'mira', role: 'biological', unionId: 'u-boen-mei', visibility: 'family' },
    { id: 'pl-4', parent: 'mei', child: 'mira', role: 'biological', unionId: 'u-boen-mei', visibility: 'family' },
    { id: 'pl-5', parent: 'kafai', child: 'linda', role: 'biological', unionId: 'u-kafai-siti', visibility: 'family' },
    { id: 'pl-6', parent: 'siti', child: 'linda', role: 'biological', unionId: 'u-kafai-siti', visibility: 'family' },
    { id: 'pl-7', parent: 'kafai', child: 'david', role: 'biological', unionId: 'u-kafai-siti', visibility: 'family' },
    { id: 'pl-8', parent: 'siti', child: 'david', role: 'biological', unionId: 'u-kafai-siti', visibility: 'family' },
    { id: 'pl-9', parent: 'eric', child: 'daniel', role: 'biological', unionId: 'u-eric-linda', visibility: 'family' },
    { id: 'pl-10', parent: 'linda', child: 'daniel', role: 'biological', unionId: 'u-eric-linda', visibility: 'family' },
    { id: 'pl-11', parent: 'eric', child: 'lisa', role: 'biological', unionId: 'u-eric-linda', visibility: 'family' },
    { id: 'pl-12', parent: 'linda', child: 'lisa', role: 'biological', unionId: 'u-eric-linda', visibility: 'family' },
    { id: 'pl-13', parent: 'mira', child: 'sterre', role: 'biological', unionId: 'u-mira-joost', visibility: 'family' },
    { id: 'pl-14', parent: 'joost', child: 'sterre', role: 'biological', unionId: 'u-mira-joost', visibility: 'family' },
    { id: 'pl-15', parent: 'david', child: 'kai', role: 'biological', unionId: 'u-david-anouk', visibility: 'family' },
    { id: 'pl-16', parent: 'anouk', child: 'kai', role: 'biological', unionId: 'u-david-anouk', visibility: 'family' },
  ],
};
