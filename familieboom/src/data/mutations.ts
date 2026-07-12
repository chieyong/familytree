import { supabase } from './supabaseClient';
import type { ImportPayload } from './importGeocode';
import type { ParentRole, UnionEndReason, UnionType } from './types';
import { BACKEND } from '../ui/store';
import { getLocalStore } from './local/store';

/** True als de app op de lokale (offline) datalaag draait i.p.v. Supabase. */
const isLocal = () => BACKEND === 'local';

export interface ImportResult {
  persons: number;
  /** Aantal bestaande personen dat is bijgewerkt (db_id-rijen). */
  updated: number;
  parentLinks: number;
  unions: number;
  /** Plaatsnamen die niet gegeocodeerd konden worden (client-side toegevoegd). */
  unresolved?: string[];
}

/**
 * Bulk-import van een platte template (RPC import_family, owner-only).
 * `existing` koppelt sleutels uit de template aan reeds bestaande persoon-uuid's.
 */
export async function importFamily(
  familyId: string,
  data: ImportPayload,
  existing: Record<string, string> = {},
): Promise<ImportResult> {
  if (isLocal()) throw new Error('Import is nog niet beschikbaar in de lokale modus.');
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { data: res, error } = await supabase.rpc('import_family', {
    p_family: familyId,
    p_data: { ...data, existing },
  });
  if (error) throw error;
  return res as ImportResult;
}

/**
 * Kopieert geselecteerde personen (+ hun onderlinge relaties) van de ene boom
 * naar de andere als nieuwe records (RPC copy_persons, owner van bron én doel).
 * Geeft het aantal gekopieerde personen terug.
 */
export async function copyPersons(
  sourceFamilyId: string,
  targetFamilyId: string,
  personIds: string[],
  /** Map bron-persoon-id → bestaand doel-persoon-id om relaties aan te knopen. */
  anchors: Record<string, string> = {},
): Promise<number> {
  if (isLocal()) throw new Error('Kopiëren tussen bomen is niet beschikbaar in de lokale modus.');
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { data, error } = await supabase.rpc('copy_persons', {
    p_source: sourceFamilyId,
    p_target: targetFamilyId,
    p_ids: personIds,
    p_anchors: anchors,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

export type RelationKind = 'parent' | 'partner' | 'child';

export interface NewRelative {
  given: string;
  callName?: string;
  familyName?: string;
  nameNative?: string;
  nickname?: string;
  sex?: 'm' | 'f' | 'x';
  birthYear?: number;
  deathYear?: number;
}

/** Voegt een persoon + relatie toe aan een ankerpunt (RPC add_relative). */
export async function addRelative(
  familyId: string,
  relation: RelationKind,
  anchorId: string,
  rel: NewRelative,
): Promise<string> {
  if (isLocal()) return getLocalStore().addRelative(relation, anchorId, rel);
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { data, error } = await supabase.rpc('add_relative', {
    p_family: familyId,
    p_relation: relation,
    p_anchor: anchorId,
    p_given: [rel.given],
    p_family_name: rel.familyName || null,
    p_sex: rel.sex ?? null,
    p_birth_year: rel.birthYear ?? null,
    p_name_native: rel.nameNative || null,
    p_nickname: rel.nickname || null,
  });
  if (error) throw error;
  const personId = (data as { personId: string }).personId;
  // De RPC kent geen sterfjaar/roepnaam; gericht bijwerken (RLS: aanmaker mag dit).
  const patch: Record<string, unknown> = {};
  if (rel.deathYear != null) patch.death_year = rel.deathYear;
  if (rel.callName?.trim()) patch.call_name = rel.callName.trim();
  if (Object.keys(patch).length > 0) {
    const { error: upErr } = await supabase.from('persons').update(patch).eq('id', personId);
    if (upErr) throw upErr;
  }
  return personId;
}

/** Koppelt twee bestaande personen (RLS: beheer over ≥1 eindpunt). */
export async function linkRelative(
  familyId: string,
  relation: RelationKind,
  anchorId: string,
  otherId: string,
): Promise<void> {
  if (isLocal()) { getLocalStore().linkRelative(relation, anchorId, otherId); return; }
  if (!supabase) throw new Error('Geen Supabase-client.');
  if (relation === 'partner') {
    const { error } = await supabase.from('unions').insert({
      family_id: familyId,
      partner_a: anchorId,
      partner_b: otherId,
      type: 'marriage',
      existence_visibility: 'family',
      detail_visibility: 'family',
    });
    if (error) throw error;
    return;
  }
  const [parent, child] = relation === 'parent' ? [otherId, anchorId] : [anchorId, otherId];
  const { error } = await supabase.from('parent_links').insert({
    family_id: familyId,
    parent_id: parent,
    child_id: child,
    existence_visibility: 'family',
    detail_visibility: 'family',
  });
  if (error) throw error;
}

export interface PersonEdit {
  given: string;
  callName?: string;
  familyName?: string;
  nameNative?: string;
  nicknames?: string[];
  preferredName?: 'full' | 'native' | 'nickname';
  sex?: 'm' | 'f' | 'x';
  birthYear?: number;
  deathYear?: number;
  visibility: 'public' | 'family' | 'private';
}

/** PersonEdit → de persons-kolommen (gedeeld door updatePerson en voorstellen). */
function personEditColumns(e: PersonEdit) {
  return {
    given_names: [e.given],
    call_name: e.callName?.trim() || null,
    family_name: e.familyName || null,
    name_native: e.nameNative || null,
    // Array is de bron; scalar `nickname` gesynchroniseerd op de eerste, zodat
    // DB-functies die nog de scalar lezen (imports, voorstellen) kloppen.
    nicknames: e.nicknames ?? [],
    nickname: e.nicknames?.[0] || null,
    preferred_name: e.preferredName && e.preferredName !== 'full' ? e.preferredName : null,
    sex: e.sex ?? null,
    birth_year: e.birthYear ?? null,
    death_year: e.deathYear ?? null,
    visibility: e.visibility,
  };
}

/** Wijzigt een persoon (RLS: beheerder/owner, of jezelf strenger zetten). */
export async function updatePerson(id: string, e: PersonEdit): Promise<void> {
  if (isLocal()) { getLocalStore().updatePerson(id, e); return; }
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { error } = await supabase.from('persons').update(personEditColumns(e)).eq('id', id);
  if (error) throw error;
}

export interface PlaceInput {
  name: string;
  lat: number;
  lon: number;
  wikidataId?: string;
}

/** Plaats opzoeken-of-aanmaken in de gedeelde `places`-tabel (RLS: ingelogd). */
async function upsertPlace(place: PlaceInput): Promise<string> {
  const { data: existing } = await supabase!
    .from('places')
    .select('id')
    .eq('name', place.name)
    .gte('lat', place.lat - 0.0015)
    .lte('lat', place.lat + 0.0015)
    .gte('lon', place.lon - 0.0015)
    .lte('lon', place.lon + 0.0015)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data, error } = await supabase!
    .from('places')
    .insert({ name: place.name, lat: place.lat, lon: place.lon, wikidata_id: place.wikidataId ?? null })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * Zet (of wist) de geboorte- of sterfteplaats van een persoon. Schrijft de plaats
 * in `places` en koppelt 'm via `birth_place_id`/`death_place_id` (RLS dwingt af dat
 * alleen beheerder/bewerker de persoon mag wijzigen). `_build_graph` leest 'm daarna
 * mee in de graaf → de persoon verschijnt op de Atlas.
 */
export async function setPersonPlace(
  personId: string,
  kind: 'birth' | 'death',
  place: PlaceInput | null,
): Promise<void> {
  if (isLocal()) { getLocalStore().setPersonPlace(personId, kind, place); return; }
  if (!supabase) throw new Error('Geen Supabase-client.');
  const placeId = place ? await upsertPlace(place) : null;
  const column = kind === 'birth' ? 'birth_place_id' : 'death_place_id';
  const { error } = await supabase.from('persons').update({ [column]: placeId }).eq('id', personId);
  if (error) throw error;
}

/** Voegt een woonplaats toe (residences-tabel; RLS-write = beheerder/bewerker). */
export async function addResidence(personId: string, place: PlaceInput, fromYear?: number): Promise<void> {
  if (isLocal()) { getLocalStore().addResidence(personId, place, fromYear); return; }
  if (!supabase) throw new Error('Geen Supabase-client.');
  const placeId = await upsertPlace(place);
  const { error } = await supabase
    .from('residences')
    .insert({ person_id: personId, place_id: placeId, from_year: fromYear ?? null });
  if (error) throw error;
}

/** Werkt het vanaf-jaar van een woonplaats bij (RLS-write = beheerder/bewerker). */
export async function updateResidence(id: string, fromYear?: number): Promise<void> {
  if (isLocal()) { getLocalStore().updateResidence(id, fromYear); return; }
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { error } = await supabase
    .from('residences')
    .update({ from_year: fromYear ?? null })
    .eq('id', id);
  if (error) throw error;
}

/** Verwijdert een woonplaats op rij-id. */
export async function removeResidence(id: string): Promise<void> {
  if (isLocal()) { getLocalStore().removeResidence(id); return; }
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { error } = await supabase.from('residences').delete().eq('id', id);
  if (error) throw error;
}

export type ProposalKind = 'person_update' | 'person_add' | 'relation_add';

export interface Proposal {
  id: string;
  familyId: string;
  authorLabel: string | null;
  kind: ProposalKind;
  targetPersonId: string | null;
  payload: Record<string, unknown>;
  summary: string | null;
  createdAt: string;
}

/** Dien een wijziging aan een bestaande persoon in als voorstel (rol Bijdrager). */
export async function submitPersonProposal(
  familyId: string,
  personId: string,
  e: PersonEdit,
  summary: string,
  authorLabel: string,
): Promise<void> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from('change_proposals').insert({
    family_id: familyId,
    author: auth.user?.id,
    author_label: authorLabel,
    kind: 'person_update',
    target_person_id: personId,
    payload: personEditColumns(e),
    summary,
  });
  if (error) throw error;
}

/** Voorstel voor een nieuwe persoon (person_add) of nieuwe koppeling (relation_add). */
export async function submitRelativeProposal(
  familyId: string,
  anchorId: string,
  kind: 'person_add' | 'relation_add',
  payload: Record<string, unknown>,
  summary: string,
  authorLabel: string,
): Promise<void> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from('change_proposals').insert({
    family_id: familyId,
    author: auth.user?.id,
    author_label: authorLabel,
    kind,
    target_person_id: anchorId,
    payload,
    summary,
  });
  if (error) throw error;
}

/** Open voorstellen voor een familie (RLS: owner/editor ziet alles). */
export async function listPendingProposals(familyId: string): Promise<Proposal[]> {
  if (isLocal() || !supabase) return [];
  const { data, error } = await supabase
    .from('change_proposals')
    .select('id, family_id, author_label, kind, target_person_id, payload, summary, created_at')
    .eq('family_id', familyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    familyId: r.family_id as string,
    authorLabel: r.author_label as string | null,
    kind: r.kind as ProposalKind,
    targetPersonId: r.target_person_id as string | null,
    payload: (r.payload as Record<string, unknown>) ?? {},
    summary: r.summary as string | null,
    createdAt: r.created_at as string,
  }));
}

/** Keur een voorstel goed (toepassen) of wijs het af (RPC, owner/editor). */
export async function resolveProposal(id: string, approve: boolean): Promise<void> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { error } = await supabase.rpc('resolve_proposal', { p_id: id, p_approve: approve });
  if (error) throw error;
}

const AVATAR_BUCKET = 'avatars';

/** Opslag-pad voor de profielfoto van een persoon (zonder extensie). */
const avatarPath = (familyId: string, personId: string) => `${familyId}/${personId}`;

/** Upload/vervang een profielfoto en zet photo_path op de persoon. */
export async function uploadPersonPhoto(familyId: string, personId: string, file: File): Promise<void> {
  if (isLocal()) throw new Error('Foto’s zijn nog niet beschikbaar in de lokale modus.');
  if (!supabase) throw new Error('Geen Supabase-client.');
  const path = avatarPath(familyId, personId);
  const up = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (up.error) throw up.error;
  const { error } = await supabase.from('persons').update({ photo_path: path }).eq('id', personId);
  if (error) throw error;
}

/** Verwijdert de profielfoto (storage + photo_path). */
export async function removePersonPhoto(familyId: string, personId: string): Promise<void> {
  if (isLocal()) return;
  if (!supabase) throw new Error('Geen Supabase-client.');
  await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath(familyId, personId)]);
  const { error } = await supabase.from('persons').update({ photo_path: null }).eq('id', personId);
  if (error) throw error;
}

/** Ondertekende (tijdelijke) URL's voor een lijst foto-paden → map pad→url. */
export async function signedAvatarUrls(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (isLocal() || !supabase || paths.length === 0) return map;
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrls(paths, 3600);
  if (error || !data) return map;
  for (const item of data) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl);
  }
  return map;
}

/** Verwijdert een persoon; relaties vervallen via FK-cascade (RLS: beheerder/owner). */
export async function deletePerson(id: string): Promise<void> {
  if (isLocal()) { getLocalStore().deletePerson(id); return; }
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { error } = await supabase.from('persons').delete().eq('id', id);
  if (error) throw error;
}

// ── Relaties bewerken/ontkoppelen (RLS: beheer over ≥1 eindpunt) ───────────

export async function setUnionType(id: string, type: UnionType): Promise<void> {
  if (isLocal()) { getLocalStore().setUnionType(id, type); return; }
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { error } = await supabase.from('unions').update({ type }).eq('id', id);
  if (error) throw error;
}

/** Zet (of wist) het startjaar van een verbintenis, bv. het huwelijksjaar. */
export async function setUnionStart(id: string, year?: number): Promise<void> {
  if (isLocal()) { getLocalStore().setUnionStart(id, year); return; }
  if (!supabase) throw new Error('Geen Supabase-client.');
  const fields = year
    ? { start_year: year }
    : { start_year: null, start_month: null, start_day: null };
  const { error } = await supabase.from('unions').update(fields).eq('id', id);
  if (error) throw error;
}

/** Markeert een verbintenis als beëindigd (reden + jaar), of weer lopend (null). */
export async function setUnionEnd(
  id: string,
  reason: UnionEndReason | null,
  year?: number,
): Promise<void> {
  if (isLocal()) { getLocalStore().setUnionEnd(id, reason, year); return; }
  if (!supabase) throw new Error('Geen Supabase-client.');
  const fields = reason
    ? { end_reason: reason, end_year: year ?? null }
    : { end_reason: null, end_year: null, end_month: null, end_day: null };
  const { error } = await supabase.from('unions').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteUnion(id: string): Promise<void> {
  if (isLocal()) { getLocalStore().deleteUnion(id); return; }
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { error } = await supabase.from('unions').delete().eq('id', id);
  if (error) throw error;
}

export async function setParentRole(id: string, role: ParentRole): Promise<void> {
  if (isLocal()) { getLocalStore().setParentRole(id, role); return; }
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { error } = await supabase.from('parent_links').update({ role }).eq('id', id);
  if (error) throw error;
}

export async function deleteParentLink(id: string): Promise<void> {
  if (isLocal()) { getLocalStore().deleteParentLink(id); return; }
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { error } = await supabase.from('parent_links').delete().eq('id', id);
  if (error) throw error;
}
