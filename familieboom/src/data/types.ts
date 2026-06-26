export type PersonID = string;
export type RelID = string;

export type Visibility = 'public' | 'family' | 'private';

/** Datum met onzekerheid — historische bronnen (Wikidata) zijn zelden dag-precies. */
export interface FuzzyDate {
  year: number;
  month?: number;
  day?: number;
  qualifier?: 'exact' | 'approx' | 'before' | 'after';
}

/** Gestructureerde plaats — lat/lon + wikidataId voor de latere wereldbol-view. */
export interface Place {
  name: string;
  lat?: number;
  lon?: number;
  wikidataId?: string;
}

export interface Residence {
  /** Rij-id uit de residences-tabel (aanwezig vanuit de backend; nodig om te verwijderen). */
  id?: string;
  place: Place;
  from?: FuzzyDate;
  to?: FuzzyDate;
}

export interface Person {
  id: PersonID;
  givenNames: string[];
  familyName?: string;
  /** Roepnaam: het hoofd-label in de boom. Eerst afgeleid van de eerste voornaam,
   *  daarna vrij te overschrijven (bv. een meerdelige voornaam als "Mey Yen"). */
  callName?: string;
  displayName?: string;
  /** Naam in eigen schrift (Chinees, Cyrillisch, Arabisch…); cultuur-neutraal vrij veld. */
  nameNative?: string;
  /** Bijnaam (informeel, bv. "Joop") — los van de roepnaam. */
  nickname?: string;
  /**
   * Welke naam als hoofd-label in de boom getoond wordt. 'full' (standaard) =
   * officiële naam, 'native' = naam in eigen schrift, 'nickname' = bijnaam.
   * Valt terug op de volledige naam als het gekozen veld leeg is.
   */
  preferredName?: 'full' | 'native' | 'nickname';
  /** Opslag-pad van de profielfoto (<family_id>/<person_id>); via signed URL geladen. */
  photoPath?: string;
  /** Brug naar dezelfde persoon in een andere familie-boom (gekoppelde bomen). */
  bridge?: { familyId: string; familyName: string; personId: string };
  sex?: 'm' | 'f' | 'x';
  birth?: { date?: FuzzyDate; place?: Place };
  death?: { date?: FuzzyDate; place?: Place };
  residences?: Residence[];
  visibility: Visibility;
  fieldVisibility?: Record<string, Visibility>;
  meta?: { wikidataId?: string; notes?: string };
  /** Stub uit de datalaag: afgeschermde persoon, render als silhouet. */
  hidden?: boolean;
}

export type UnionType = 'marriage' | 'registered' | 'cohabitation' | 'relationship';
export type UnionEndReason = 'divorce' | 'separation' | 'death';

/** Partnerschap als eersteklas object met tijdsdimensie. */
export interface Union {
  id: RelID;
  partners: [PersonID, PersonID];
  type: UnionType;
  start?: FuzzyDate;
  end?: { date?: FuzzyDate; reason: UnionEndReason };
  visibility: Visibility;
}

export type ParentRole = 'biological' | 'adoptive' | 'step' | 'foster';

/**
 * Ouder–kind per ouder (niet per ouderpaar): hierdoor zijn half-siblings,
 * stieffamilie en meerdere ouderparen afleidbaar in plaats van opgeslagen.
 * Conventie: de eerste link van een kind is de "naamgevende" ouder.
 */
export interface ParentChildLink {
  id: RelID;
  parent: PersonID;
  child: PersonID;
  role: ParentRole;
  unionId?: RelID;
  start?: FuzzyDate;
  visibility: Visibility;
}

export interface FamilyGraph {
  persons: Person[];
  unions: Union[];
  parentLinks: ParentChildLink[];
}
