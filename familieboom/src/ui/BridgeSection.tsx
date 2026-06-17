import { useState } from 'react';
import type { Person } from '../data/types';
import { acceptBridgeInvite, createBridgeInvite } from '../data/bridges';
import { useAppStore } from './store';
import { useFamilies } from './useFamilies';

interface Props {
  person: Person;
  familyId: string;
}

/**
 * Koppel deze persoon aan dezelfde persoon in een andere familie-boom.
 * De owner van de andere boom maakt een koppel-code; jij plakt 'm hier (of
 * andersom). Alleen owners kunnen koppelen.
 */
export function BridgeSection({ person, familyId }: Props) {
  const bumpData = useAppStore((s) => s.bumpData);
  const setNotice = useAppStore((s) => s.setNotice);
  const { families } = useFamilies();
  const isOwner = families.find((f) => f.id === familyId)?.role === 'owner';

  const [token, setToken] = useState<string>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (person.bridge) {
    return (
      <section className="panel-section">
        <div className="panel-label">Andere familie</div>
        <p className="bridge-linked">🔗 Gekoppeld aan familie <strong>{person.bridge.familyName}</strong></p>
      </section>
    );
  }

  if (!isOwner) return null;

  const generate = async () => {
    setBusy(true);
    setError(undefined);
    try {
      setToken(await createBridgeInvite(familyId, person.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code maken mislukt');
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      await acceptBridgeInvite(code.trim(), familyId, person.id);
      bumpData();
      setNotice(`${person.givenNames[0] ?? 'Deze persoon'} is nu gekoppeld aan de andere familie.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Koppelen mislukt');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel-section">
      <div className="panel-label">Andere familie</div>
      <p className="bridge-hint">
        Koppel deze persoon aan dezelfde persoon in een andere boom. Beide beheerders
        moeten het doen: de één maakt een code, de ander plakt 'm.
      </p>

      <button className="share-link-btn" onClick={generate} disabled={busy}>
        {token ? 'Nieuwe code' : 'Maak koppel-code'}
      </button>
      {token && (
        <input
          className="share-link"
          readOnly
          value={token}
          onFocus={(e) => {
            e.target.select();
            void navigator.clipboard?.writeText(token);
          }}
          title="Klik om te kopiëren"
        />
      )}

      <div className="bridge-accept">
        <input
          placeholder="Of plak hier een code…"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button onClick={accept} disabled={busy || !code.trim()}>Koppel</button>
      </div>

      {error && <p className="add-rel-error">{error}</p>}
    </section>
  );
}
