import { supabase } from './supabaseClient';

export interface Member {
  profileId: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
  status: 'pending' | 'active';
}

export interface AcceptResult {
  familyId: string;
  familyName: string;
  status: 'pending' | 'active';
}

/** Owner/editor maakt een deelbare uitnodigingslink en geeft de token terug. */
export async function createInvite(
  familyId: string,
  role: Member['role'],
  createdBy: string,
): Promise<string> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { data, error } = await supabase
    .from('family_invites')
    .insert({ family_id: familyId, role, created_by: createdBy })
    .select('token')
    .single();
  if (error) throw error;
  return (data as { token: string }).token;
}

/** Accepteer een uitnodiging (→ pending lid) via token. */
export async function acceptInvite(token: string): Promise<AcceptResult> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { data, error } = await supabase.rpc('accept_invite', { p_token: token });
  if (error) throw error;
  return data as AcceptResult;
}

export async function listMembers(familyId: string): Promise<Member[]> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { data, error } = await supabase.rpc('list_members', { p_family: familyId });
  if (error) throw error;
  return (data as Member[]) ?? [];
}

/** Owner keurt een pending lid goed (→ active). */
export async function approveMember(familyId: string, profileId: string): Promise<void> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { error } = await supabase
    .from('family_members')
    .update({ status: 'active' })
    .eq('family_id', familyId)
    .eq('profile_id', profileId);
  if (error) throw error;
}

/** Koppel je account aan een persoon-knooppunt ("dit ben ik"). RPC, elk lid. */
export async function claimSelfPerson(familyId: string, personId: string): Promise<void> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { error } = await supabase.rpc('claim_self_person', { p_family: familyId, p_person: personId });
  if (error) throw error;
}

/** Owner wijzigt de rol van een lid (lezer ↔ bewerker). RLS: owner. */
export async function updateMemberRole(
  familyId: string,
  profileId: string,
  role: 'viewer' | 'editor',
): Promise<void> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { error } = await supabase
    .from('family_members')
    .update({ role })
    .eq('family_id', familyId)
    .eq('profile_id', profileId);
  if (error) throw error;
}

/** Owner verwijdert een lid (of een afgewezen/pending verzoek). RLS: owner. */
export async function removeMember(familyId: string, profileId: string): Promise<void> {
  if (!supabase) throw new Error('Geen Supabase-client.');
  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('family_id', familyId)
    .eq('profile_id', profileId);
  if (error) throw error;
}
