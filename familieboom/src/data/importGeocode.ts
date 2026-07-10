import { geocode } from './geocode';
import type { ImportData, ImportPerson } from './importTemplate';

/** Plaats met (indien gevonden) coördinaten. Coördinaten kunnen ontbreken als
 *  de geocode faalde; de naam gaat dan toch mee, zodat een bestaande plek bij
 *  een update niet gewist wordt en de plaats (naam-only) behouden blijft. */
export interface GeoPlace {
  name: string;
  lat?: number;
  lon?: number;
}

/** Persoon zoals naar de import-RPC gestuurd: plaatsen als coördinaat-objecten. */
export type ImportPayloadPerson = Omit<ImportPerson, 'birthPlace' | 'deathPlace' | 'residences'> & {
  birthPlace?: GeoPlace;
  deathPlace?: GeoPlace;
  residences?: (GeoPlace & { fromYear?: number })[];
};

export interface ImportPayload {
  persons: ImportPayloadPerson[];
  parentLinks: ImportData['parentLinks'];
  unions: ImportData['unions'];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Zoekt alle (unieke) plaatsnamen in de import op via de geocoder en verrijkt de
 * personen met coördinaten. Nominatim vraagt ~1 verzoek/sec, dus we zoeken
 * sequentieel met een korte pauze en rapporteren voortgang. Plaatsen die niet
 * gevonden worden vallen weg (in `unresolved`) — de persoon komt er wél, zonder
 * die plek.
 */
export async function geocodeImport(
  data: ImportData,
  lang: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ payload: ImportPayload; unresolved: string[] }> {
  const names = new Set<string>();
  for (const p of data.persons) {
    if (p.birthPlace) names.add(p.birthPlace);
    if (p.deathPlace) names.add(p.deathPlace);
    for (const r of p.residences ?? []) names.add(r.name);
  }

  const list = [...names];
  const coords = new Map<string, GeoPlace | null>();
  let done = 0;
  onProgress?.(0, list.length);
  for (const name of list) {
    try {
      const hits = await geocode(name, lang);
      coords.set(name, hits[0] ? { name, lat: hits[0].lat, lon: hits[0].lon } : null);
    } catch {
      coords.set(name, null);
    }
    onProgress?.(++done, list.length);
    if (done < list.length) await sleep(1100); // Nominatim-beleefdheid
  }

  // Naam gaat altijd mee; coördinaten alleen als ze gevonden zijn (anders naam-only).
  const resolve = (name?: string): GeoPlace | undefined =>
    name ? coords.get(name) ?? { name } : undefined;

  const persons: ImportPayloadPerson[] = data.persons.map((p) => ({
    ...p,
    birthPlace: resolve(p.birthPlace),
    deathPlace: resolve(p.deathPlace),
    residences: (p.residences ?? []).map((r) => ({
      ...(coords.get(r.name) ?? { name: r.name }),
      fromYear: r.fromYear,
    })),
  }));

  const unresolved = list.filter((n) => !coords.get(n));
  return { payload: { persons, parentLinks: data.parentLinks, unions: data.unions }, unresolved };
}
