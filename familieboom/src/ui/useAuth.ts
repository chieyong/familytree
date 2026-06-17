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
  const setActiveFamily = useAppStore((s) => s.setActiveFamily);
  const setNotice = useAppStore((s) => s.setNotice);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(toUser(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(toUser(session));
      // Bij uitloggen terug naar de publieke demo + een bevestiging.
      if (event === 'SIGNED_OUT') {
        setActiveFamily(null);
        setNotice('Je bent uitgelogd — je ziet weer de demo.');
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [setUser, setActiveFamily, setNotice]);

  // Volledige huidige URL minus hash → behoudt o.a. ?invite=<token> door de
  // login-redirect heen, zodat de uitnodiging na inloggen verwerkt wordt.
  const redirectUrl = () => window.location.href.split('#')[0];

  const signInWithEmail = async (email: string) => {
    if (!supabase) return { error: new Error('Geen Supabase-client.') };
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectUrl() },
    });
  };

  const signInWithGoogle = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl() },
    });
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
  };

  return { user, available: !!supabase, signInWithEmail, signInWithGoogle, signOut };
}
