import { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../data/supabaseClient';
import { useAppStore, type SessionUser } from './store';

const toUser = (session: Session | null): SessionUser | null =>
  session?.user ? { id: session.user.id, email: session.user.email } : null;

/**
 * Auth-sessie rond Supabase, gesynchroniseerd naar de store (één bron van
 * waarheid voor `user`). Magic link werkt meteen; Google zodra de provider
 * geconfigureerd is. `available` is false zonder client (fixtures-only deploy).
 */
export function useAuth() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(toUser(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(toUser(session)),
    );
    return () => sub.subscription.unsubscribe();
  }, [setUser]);

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

  return { user, available: !!supabase, signInWithEmail, signInWithGoogle, signOut };
}
