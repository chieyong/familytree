import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../data/supabaseClient';

/**
 * Auth-sessie rond Supabase. Provider-onafhankelijk: magic link werkt meteen,
 * Google komt erbij zodra de OAuth-provider in het dashboard is geconfigureerd.
 * `available` is false als er geen client is (bv. de fixtures-only deploy).
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email: string) => {
    if (!supabase) return { error: new Error('Geen Supabase-client.') };
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
  };

  const signInWithGoogle = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
  };

  return { user, ready, available: !!supabase, signInWithEmail, signInWithGoogle, signOut };
}
