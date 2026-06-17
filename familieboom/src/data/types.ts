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
  place: Place;
  from?: FuzzyDate;
  to?: FuzzyDate;
}

export interface Person {
  id: PersonID;
  givenNames: string[];
  familyName?: string;
  displayName?: string;
  /** Naam in eigen schrift (Chinees, Cyrillisch, Arabisch…); cultuur-neutraal vrij veld. */
  nameNative?: string;
  /** Bijnaam / roepnaam / alias. */
  nickname?: string;
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
