/**
 * Geocoder via OpenStreetMap Nominatim: plaatsnaam → coördinaten. Geen API-sleutel,
 * wereldwijde dekking. Nominatim ondersteunt CORS, dus dit kan client-side. De UI
 * (PlaceField) debounced de aanroepen en zoekt pas vanaf 2 tekens, conform het
 * gebruiksbeleid. Resultaten dragen OSM-data → toon bronvermelding in de UI.
 */

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

export interface GeoHit {
  /** Beknopte naam, bv. "Bandung". */
  name: string;
  /** Volledige naam voor disambiguatie, bv. "Bandung, West-Java, Indonesië". */
  display: string;
  lat: number;
  lon: number;
}

export async function geocode(query: string, lang = 'en', signal?: AbortSignal): Promise<GeoHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: '6',
    'accept-language': lang,
  });
  const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Geocode mislukt (${res.status})`);
  const data = (await res.json()) as Array<{ name?: string; display_name: string; lat: string; lon: string }>;
  return data
    .map((d) => ({
      name: d.name?.trim() || d.display_name.split(',')[0]?.trim() || d.display_name,
      display: d.display_name,
      lat: Number.parseFloat(d.lat),
      lon: Number.parseFloat(d.lon),
    }))
    .filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon));
}
