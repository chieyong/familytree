import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../data/supabaseClient';
import { useAppStore } from './store';

export interface MyFamily {
  id: string;
  name: string;
  role: string;
  selfPersonId: string | null;
}

/** Families waar de ingelogde gebruiker actief lid van is, plus een aanmaak-actie. */
export function useFamilies() {
  const user = useAppStore((s) => s.user);
  const [families, setFamilies] = useState<MyFamily[]>([]);

  const refetch = useCallback(async () => {
    if (!supabase || !user) {
      setFamilies([]);
      return;
    }
    const { data, error } = await supabase
      .from('family_members')
      .select('role, self_person_id, families(id, name)')
      .eq('profile_id', user.id)
      .eq('status', 'active');
    if (error || !data) return;
    setFamilies(
      data.map((row) => {
        const fam = row.families as unknown as { id: string; name: string };
        return { id: fam.id, name: fam.name, role: row.role as string, selfPersonId: row.self_person_id as string | null };
      }),
    );
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  /** Maakt familie + jouw persoon + zelf-koppeling (RPC), en herlaadt de lijst. */
  const createFamily = async (name: string, given: string, familyName: string) => {
    if (!supabase) throw new Error('Geen Supabase-client.');
    const { data, error } = await supabase.rpc('create_family', {
      p_name: name,
      p_self_given_names: [given],
      p_self_family_name: familyName || null,
    });
    if (error) throw error;
    await refetch();
    return data as { familyId: string; personId: string };
  };

  return { families, refetch, createFamily };
}
