import { useState } from 'react';
import type { Person } from '../data/types';
import { addRelative, linkRelative, type RelationKind } from '../data/mutations';
import { shortName } from './theme';
import { useAppStore } from './store';

interface Props {
  familyId: string;
  anchorId: string;
  anchorName: string;
  /** Bestaande personen om aan te koppelen (de hele familie). */
  candidates: Person[];
}

const LABEL: Record<RelationKind, string> = { parent: 'ouder', partner: 'partner', child: 'kind' };

/** CRUD: voeg een ouder/partner/kind toe — nieuw of een bestaande persoon. */
export function AddRelative({ familyId, anchorId, anchorName, candidates }: Props) {
  const bumpData = useAppStore((s) => s.bumpData);
  const setFocus = useAppStore((s) => s.setFocus);
  const [relation, setRelation] = useState<RelationKind | null>(null);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [given, setGiven] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [nameNative, setNameNative] = useState('');
  const [nickname, setNickname] = useState('');
  const [sex, setSex] = useState<'m' | 'f' | 'x' | ''>('');
  const [birthYear, setBirthYear] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const reset = () => {
    setRelation(null);
    setMode('new');
    setGiven('');
    setFamilyName('');
    setNameNative('');
    setNickname('');
    setSex('');
    setBirthYear('');
    setQuery('');
    setError(undefined);
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relation) return;
    setBusy(true);
    setError(undefined);
    try {
      const id = await addRelative(familyId, relation, anchorId, {
        given: given.trim(),
        familyName: familyName.trim() || undefined,
        nameNative: nameNative.trim() || undefined,
        nickname: nickname.trim() || undefined,
        sex: sex || undefined,
        birthYear: birthYear ? Number(birthYear) : undefined,
      });
      bumpData();
      reset();
      setFocus(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toevoegen mislukt');
    } finally {
      setBusy(false);
    }
  };

  const pick = async (otherId: string) => {
    if (!relation) return;
    setBusy(true);
    setError(undefined);
    try {
      await linkRelative(familyId, relation, anchorId, otherId);
      bumpData();
      reset();
      setFocus(otherId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Koppelen mislukt');
    } finally {
      setBusy(false);
    }
  };

  if (!relation) {
    return (
      <div className="add-relative-bar">
        {(['parent', 'partner', 'child'] as RelationKind[]).map((r) => (
          <button key={r} className="add-rel-btn" onClick={() => setRelation(r)}>
            + {LABEL[r]}
          </button>
        ))}
      </div>
    );
  }

  const matches = candidates
    .filter((p) => p.id !== anchorId && !p.hidden)
    .filter((p) => shortName(p).toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => shortName(a).localeCompare(shortName(b)))
    .slice(0, 50);

  return (
    <div className="add-relative-form">
      <div className="add-rel-title">
        {LABEL[relation]} van {anchorName}
      </div>
      <div className="add-rel-tabs">
        <button className={mode === 'new' ? 'active' : ''} onClick={() => setMode('new')}>nieuw</button>
        <button className={mode === 'existing' ? 'active' : ''} onClick={() => setMode('existing')}>
          bestaand
        </button>
      </div>

      {mode === 'new' ? (
        <form onSubmit={submitNew}>
          <input placeholder="Voornaam" value={given} required autoFocus
            onChange={(e) => setGiven(e.target.value)} />
          <input placeholder="Achternaam" value={familyName}
            onChange={(e) => setFamilyName(e.target.value)} />
          <input placeholder="Naam in eigen schrift (林麗莎, Иван…)" value={nameNative}
            onChange={(e) => setNameNative(e.target.value)} />
          <input placeholder="Bijnaam / roepnaam" value={nickname}
            onChange={(e) => setNickname(e.target.value)} />
          <div className="add-rel-row">
            <select value={sex} onChange={(e) => setSex(e.target.value as typeof sex)}>
              <option value="">geslacht</option>
              <option value="f">v</option>
              <option value="m">m</option>
              <option value="x">x</option>
            </select>
            <input className="add-rel-year" placeholder="geb. jaar" inputMode="numeric"
              value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="add-rel-row">
            <button type="submit" disabled={busy}>{busy ? '…' : 'Toevoegen'}</button>
            <button type="button" className="add-rel-cancel" onClick={reset}>annuleer</button>
          </div>
        </form>
      ) : (
        <>
          <input placeholder="Zoek persoon…" value={query} autoFocus
            onChange={(e) => setQuery(e.target.value)} />
          <div className="add-rel-list">
            {matches.map((p) => (
              <button key={p.id} className="add-rel-pick" disabled={busy} onClick={() => pick(p.id)}>
                {shortName(p)}
              </button>
            ))}
            {matches.length === 0 && <div className="family-empty">geen match</div>}
          </div>
          <button type="button" className="add-rel-cancel" onClick={reset}>annuleer</button>
        </>
      )}
      {error && <p className="add-rel-error">{error}</p>}
    </div>
  );
}
