import { supabase } from './supabaseClient';

export type RelationKind = 'parent' | 'partner' | 'child';

export interface NewRelative {
  given: string;
  familyName?: string;
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
  });
  if (error) throw error;
  return (data as { personId: string }).personId;
}
