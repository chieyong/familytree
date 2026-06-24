import { supabase } from './supabaseClient';
import type { ImportData } from './importTemplate';
import type { ParentRole, UnionEndReason, UnionType } from './types';

export interface ImportResult {
  persons: number;
  parentLinks: number;
  unions: number;
}

/**
 * Bulk-import van een platte template (RPC import_family, owner-only).
 * `existing` koppelt sleutels uit de template aan reeds bestaande persoon-uuid's.
 */
export async function importFamily(
  familyId: string,
  data: ImportData,
  existing: Record<string, string> = {},
): Promise<ImportResult> {
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
): Promise<number> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { data, error } = await supabase.rpc('copy_persons', {
    p_source: sourceFamilyId,
    p_target: targetFamilyId,
    p_ids: personIds,
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
  nickname?: string;
  preferredName?: 'full' | 'native' | 'nickname';
  sex?: 'm' | 'f' | 'x';
  birthYear?: number;
  deathYear?: number;
  visibility: 'public' | 'family' | 'private';
}

/** Wijzigt een persoon (RLS: beheerder/owner, of jezelf strenger zetten). */
export async function updatePerson(id: string, e: PersonEdit): Promise<void> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { error } = await supabase
    .from('persons')
    .update({
      given_names: [e.given],
      call_name: e.callName?.trim() || null,
      family_name: e.familyName || null,
      name_native: e.nameNative || null,
      nickname: e.nickname || null,
      preferred_name: e.preferredName && e.preferredName !== 'full' ? e.preferredName : null,
      sex: e.sex ?? null,
      birth_year: e.birthYear ?? null,
      death_year: e.deathYear ?? null,
      visibility: e.visibility,
    })
    .eq('id', id);
  if (error) throw error;
}

const AVATAR_BUCKET = 'avatars';

/** Opslag-pad voor de profielfoto van een persoon (zonder extensie). */
const avatarPath = (familyId: string, personId: string) => `${familyId}/${personId}`;

/** Upload/vervang een profielfoto en zet photo_path op de persoon. */
export async function uploadPersonPhoto(familyId: string, personId: string, file: File): Promise<void> {
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
  if (!supabase) throw new Error('Geen Supabase-client.');
  await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath(familyId, personId)]);
  const { error } = await supabase.from('persons').update({ photo_path: null }).eq('id', personId);
  if (error) throw error;
}

/** Ondertekende (tijdelijke) URL's voor een lijst foto-paden → map pad→url. */
export async function signedAvatarUrls(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabase || paths.length === 0) return map;
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrls(paths, 3600);
  if (error || !data) return map;
  for (const item of data) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl);
  }
  return map;
}

/** Verwijdert een persoon; relaties vervallen via FK-cascade (RLS: beheerder/owner). */
export async function deletePerson(id: string): Promise<void> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { error } = await supabase.from('persons').delete().eq('id', id);
  if (error) throw error;
}

// ── Relaties bewerken/ontkoppelen (RLS: beheer over ≥1 eindpunt) ───────────

export async function setUnionType(id: string, type: UnionType): Promise<void> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { error } = await supabase.from('unions').update({ type }).eq('id', id);
  if (error) throw error;
}

/** Zet (of wist) het startjaar van een verbintenis, bv. het huwelijksjaar. */
export async function setUnionStart(id: string, year?: number): Promise<void> {
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
  if (!supabase) throw new Error('Geen Supabase-client.');
  const fields = reason
    ? { end_reason: reason, end_year: year ?? null }
    : { end_reason: null, end_year: null, end_month: null, end_day: null };
  const { error } = await supabase.from('unions').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteUnion(id: string): Promise<void> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { error } = await supabase.from('unions').delete().eq('id', id);
  if (error) throw error;
}

export async function setParentRole(id: string, role: ParentRole): Promise<void> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { error } = await supabase.from('parent_links').update({ role }).eq('id', id);
  if (error) throw error;
}

export async function deleteParentLink(id: string): Promise<void> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { error } = await supabase.from('parent_links').delete().eq('id', id);
  if (error) throw error;
}
