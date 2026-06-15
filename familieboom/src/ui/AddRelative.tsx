import { useState } from 'react';
import { addRelative, type RelationKind } from '../data/mutations';
import { useAppStore } from './store';

interface Props {
  familyId: string;
  anchorId: string;
  anchorName: string;
}

const LABEL: Record<RelationKind, string> = { parent: 'ouder', partner: 'partner', child: 'kind' };

/** CRUD: voeg een ouder/partner/kind toe aan de focuspersoon (eigen boom). */
export function AddRelative({ familyId, anchorId, anchorName }: Props) {
  const bumpData = useAppStore((s) => s.bumpData);
  const setFocus = useAppStore((s) => s.setFocus);
  const [relation, setRelation] = useState<RelationKind | null>(null);
  const [given, setGiven] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [sex, setSex] = useState<'m' | 'f' | 'x' | ''>('');
  const [birthYear, setBirthYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const reset = () => {
    setRelation(null);
    setGiven('');
    setFamilyName('');
    setSex('');
    setBirthYear('');
    setError(undefined);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relation) return;
    setBusy(true);
    setError(undefined);
    try {
      const id = await addRelative(familyId, relation, anchorId, {
        given: given.trim(),
        familyName: familyName.trim() || undefined,
        sex: sex || undefined,
        birthYear: birthYear ? Number(birthYear) : undefined,
      });
      bumpData();
      reset();
      setFocus(id); // spring naar de nieuwe persoon
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toevoegen mislukt');
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

  return (
    <form className="add-relative-form" onSubmit={submit}>
      <div className="add-rel-title">
        {LABEL[relation]} van {anchorName}
      </div>
      <input placeholder="Voornaam" value={given} required autoFocus
        onChange={(e) => setGiven(e.target.value)} />
      <input placeholder="Achternaam" value={familyName}
        onChange={(e) => setFamilyName(e.target.value)} />
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
      {error && <p className="add-rel-error">{error}</p>}
      <div className="add-rel-row">
        <button type="submit" disabled={busy}>{busy ? '…' : 'Toevoegen'}</button>
        <button type="button" className="add-rel-cancel" onClick={reset}>annuleer</button>
      </div>
    </form>
  );
}
