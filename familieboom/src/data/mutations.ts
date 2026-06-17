import { supabase } from './supabaseClient';
import type { ImportData } from './importTemplate';
import type { ParentRole, UnionEndReason, UnionType } from './types';

export interface ImportResult {
  persons: number;
  parentLinks: number;
  unions: number;
}

/** Bulk-import van een platte template (RPC import_family, owner-only). */
export async function importFamily(familyId: string, data: ImportData): Promise<ImportResult> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { data: res, error } = await supabase.rpc('import_family', {
    p_family: familyId,
    p_data: data,
  });
  if (error) throw error;
  return res as ImportResult;
}

export type RelationKind = 'parent' | 'partner' | 'child';

export interface NewRelative {
  given: string;
  familyName?: string;
  nameNative?: string;
  nickname?: string;
  sex?: 'm' | 'f' | 'x';
  birthYear?: number;
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
  return (data as { personId: string }).personId;
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
  familyName?: string;
  nameNative?: string;
  nickname?: string;
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
      family_name: e.familyName || null,
      name_native: e.nameNative || null,
      nickname: e.nickname || null,
      sex: e.sex ?? null,
      birth_year: e.birthYear ?? null,
      death_year: e.deathYear ?? null,
      visibility: e.visibility,
    })
    .eq('id', id);
  if (error) throw error;
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
