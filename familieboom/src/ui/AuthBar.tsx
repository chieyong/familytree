import { useState } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from './store';
import { useT } from './useT';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

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
  const [accountOpen, setAccountOpen] = useState(false);

  if (!available) return null; // geen client (fixtures-only deploy)

  if (user) {
    return (
      <div className="account-menu">
        <button className="auth-btn" onClick={() => setAccountOpen((o) => !o)}>
          {t.auth.loggedIn}
        </button>
        {accountOpen && <div className="lang-backdrop" onClick={() => setAccountOpen(false)} />}
        {accountOpen && (
          <div className="account-pop">
            {user.email && <div className="account-email">{user.email}</div>}
            <button
              className="account-logout"
              onClick={() => {
                setAccountOpen(false);
                signOut();
              }}
            >
              {t.auth.logout}
            </button>
          </div>
        )}
      </div>
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
                  <GoogleIcon />
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
