import { useState } from 'react';
import type { Person } from '../data/types';
import { acceptBridgeInvite, createBridgeInvite } from '../data/bridges';
import { useAppStore } from './store';
import { useFamilies } from './useFamilies';
import { useT } from './useT';

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
  const t = useT();
  const { families } = useFamilies();
  const isOwner = families.find((f) => f.id === familyId)?.role === 'owner';

  const [token, setToken] = useState<string>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (person.bridge) {
    return (
      <section className="panel-section">
        <div className="panel-label">{t.bridge.section}</div>
        <p className="bridge-linked">{t.bridge.linked(person.bridge.familyName)}</p>
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
      setError(err instanceof Error ? err.message : t.bridge.codeFailed);
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
      setNotice(t.bridge.bridged(person.givenNames[0] ?? '?'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.bridge.linkFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel-section">
      <div className="panel-label">{t.bridge.section}</div>
      <p className="bridge-hint">{t.bridge.hint}</p>

      <button className="share-link-btn" onClick={generate} disabled={busy}>
        {token ? t.bridge.newCode : t.bridge.makeCode}
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
          title={t.bridge.copyTitle}
        />
      )}

      <div className="bridge-accept">
        <input
          placeholder={t.bridge.paste}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button onClick={accept} disabled={busy || !code.trim()}>{t.bridge.link}</button>
      </div>

      {error && <p className="add-rel-error">{error}</p>}
    </section>
  );
}
