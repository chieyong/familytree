import { useState } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from './store';
import { useT } from './useT';

/**
 * Account-control in de topbar: inloggen (magic link / Google) of uitloggen.
 * De demo blijft publiek; login ontsluit straks je eigen families.
 */
export function AuthBar() {
  const { user, available, signInWithEmail, signInWithGoogle, signOut } = useAuth();
  const open = useAppStore((s) => s.authOpen);
  const setOpen = useAppStore((s) => s.setAuthOpen);
  const t = useT();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();

  if (!available) return null; // geen client (fixtures-only deploy)

  if (user) {
    return (
      <button className="auth-btn" onClick={() => signOut()} title={t.auth.logout}>
        {user.email?.split('@')[0] ?? t.auth.account} · {t.auth.logout}
      </button>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    const { error } = await signInWithEmail(email.trim());
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <>
      <button className="auth-btn" onClick={() => setOpen(true)}>
        {t.auth.login}
      </button>
      {open && (
        <div className="auth-overlay" onClick={() => setOpen(false)}>
          <div className="auth-card" onClick={(e) => e.stopPropagation()}>
            <h2>{t.auth.login}</h2>
            {sent ? (
              <p className="auth-note">{t.auth.checkEmail(email)}</p>
            ) : (
              <>
                <button className="auth-google" onClick={() => signInWithGoogle()}>
                  {t.auth.withGoogle}
                </button>
                <div className="auth-or">{t.auth.or}</div>
                <form onSubmit={submit}>
                  <input
                    type="email"
                    required
                    placeholder={t.auth.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <button type="submit">{t.auth.sendMagic}</button>
                </form>
                {error && <p className="auth-error">{error}</p>}
              </>
            )}
            <button className="auth-close" onClick={() => setOpen(false)}>
              {t.auth.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
