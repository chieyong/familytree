import { useState } from 'react';
import type { Person } from '../data/types';
import { addRelative, linkRelative, type RelationKind } from '../data/mutations';
import { shortName } from './theme';
import { useAppStore } from './store';
import { useT } from './useT';

interface Props {
  familyId: string;
  anchorId: string;
  anchorName: string;
  /** Bestaande personen om aan te koppelen (de hele familie). */
  candidates: Person[];
}

/** CRUD: voeg een ouder/partner/kind toe — nieuw of een bestaande persoon. */
export function AddRelative({ familyId, anchorId, anchorName, candidates }: Props) {
  const bumpData = useAppStore((s) => s.bumpData);
  const t = useT();
  const LABEL: Record<RelationKind, string> = { parent: t.add.parent, partner: t.add.partner, child: t.add.child };
  const [relation, setRelation] = useState<RelationKind | null>(null);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [given, setGiven] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [nameNative, setNameNative] = useState('');
  const [nickname, setNickname] = useState('');
  const [sex, setSex] = useState<'m' | 'f' | 'x' | ''>('');
  const [birthYear, setBirthYear] = useState('');
  const [deathYear, setDeathYear] = useState('');
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
    setDeathYear('');
    setQuery('');
    setError(undefined);
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relation) return;
    setBusy(true);
    setError(undefined);
    try {
      await addRelative(familyId, relation, anchorId, {
        given: given.trim(),
        familyName: familyName.trim() || undefined,
        nameNative: nameNative.trim() || undefined,
        nickname: nickname.trim() || undefined,
        sex: sex || undefined,
        birthYear: birthYear ? Number(birthYear) : undefined,
        deathYear: deathYear ? Number(deathYear) : undefined,
      });
      // Focus blijft bewust op de ankerpersoon, zodat het bewerkpaneel waar je de
      // relatie toevoegde open blijft (en je meteen nóg een relatie kunt toevoegen).
      bumpData();
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.add.addFailed);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : t.add.linkFailed);
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
        {t.add.titleOf(LABEL[relation], anchorName)}
      </div>
      <div className="add-rel-tabs">
        <button className={mode === 'new' ? 'active' : ''} onClick={() => setMode('new')}>{t.add.tabNew}</button>
        <button className={mode === 'existing' ? 'active' : ''} onClick={() => setMode('existing')}>
          {t.add.tabExisting}
        </button>
      </div>

      {mode === 'new' ? (
        <form onSubmit={submitNew}>
          <input placeholder={t.edit.firstName} value={given} required autoFocus
            onChange={(e) => setGiven(e.target.value)} />
          <input placeholder={t.edit.lastName} value={familyName}
            onChange={(e) => setFamilyName(e.target.value)} />
          <input placeholder={t.edit.nativeName} value={nameNative}
            onChange={(e) => setNameNative(e.target.value)} />
          <input placeholder={t.edit.nickname} value={nickname}
            onChange={(e) => setNickname(e.target.value)} />
          <div className="add-rel-row">
            <select value={sex} onChange={(e) => setSex(e.target.value as typeof sex)}>
              <option value="">{t.edit.sex}</option>
              <option value="f">{t.edit.sexF}</option>
              <option value="m">{t.edit.sexM}</option>
              <option value="x">{t.edit.sexX}</option>
            </select>
            <input className="add-rel-year" placeholder={t.add.birthYear} inputMode="numeric"
              value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ''))} />
            <input className="add-rel-year" placeholder={t.add.deathYear} inputMode="numeric"
              value={deathYear} onChange={(e) => setDeathYear(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="add-rel-row">
            <button type="submit" disabled={busy}>{busy ? '…' : t.add.addBtn}</button>
            <button type="button" className="add-rel-cancel" onClick={reset}>{t.add.cancel}</button>
          </div>
        </form>
      ) : (
        <>
          <input placeholder={t.add.search} value={query} autoFocus
            onChange={(e) => setQuery(e.target.value)} />
          <div className="add-rel-list">
            {matches.map((p) => (
              <button key={p.id} className="add-rel-pick" disabled={busy} onClick={() => pick(p.id)}>
                {shortName(p)}
              </button>
            ))}
            {matches.length === 0 && <div className="family-empty">{t.add.noMatch}</div>}
          </div>
          <button type="button" className="add-rel-cancel" onClick={reset}>{t.add.cancel}</button>
        </>
      )}
      {error && <p className="add-rel-error">{error}</p>}
    </div>
  );
}
