import { supabase } from './supabaseClient';

/**
 * Gekoppelde bomen (fase 1). Een brug verbindt dezelfde persoon in twee bomen.
 * De owner van familie B maakt een koppel-code voor een persoon; de owner van
 * familie A accepteert die op zijn eigen persoon → de brug wordt actief.
 */

/** Owner maakt een koppel-code voor een persoon in zijn boom (→ deelbare token). */
export async function createBridgeInvite(familyId: string, personId: string): Promise<string> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { data, error } = await supabase.rpc('create_bridge_invite', {
    p_family: familyId,
    p_person: personId,
  });
  if (error) throw error;
  return data as string;
}

export interface BridgeAccepted {
  familyB: string;
  personB: string;
}

/** Owner accepteert een koppel-code op zijn eigen persoon → brug wordt actief. */
export async function acceptBridgeInvite(
  token: string,
  familyId: string,
  personId: string,
): Promise<BridgeAccepted> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { data, error } = await supabase.rpc('accept_bridge_invite', {
    p_token: token,
    p_family_a: familyId,
    p_person_a: personId,
  });
  if (error) throw error;
  return data as BridgeAccepted;
}

/** Vraag toegang tot een via een brug verbonden familie (→ pending lidmaatschap). */
export async function requestFamilyAccess(familyId: string): Promise<string> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { data, error } = await supabase.rpc('request_family_access', { p_family: familyId });
  if (error) throw error;
  return data as string;
}
