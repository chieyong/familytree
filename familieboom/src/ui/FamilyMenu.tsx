import { useState } from 'react';
import { supabase } from '../data/supabaseClient';
import { useAppStore, type DatasetId } from './store';
import { useFamilies } from './useFamilies';

const PRESETS: { id: DatasetId; label: string }[] = [
  { id: 'demo', label: 'Demo-familie' },
  { id: 'habsburg', label: 'Habsburg (Wikidata)' },
];

/** Bron-keuze: demo-presets, je eigen families, of een nieuwe boom aanmaken. */
export function FamilyMenu() {
  const dataset = useAppStore((s) => s.dataset);
  const activeFamily = useAppStore((s) => s.activeFamily);
  const user = useAppStore((s) => s.user);
  const setDataset = useAppStore((s) => s.setDataset);
  const setActiveFamily = useAppStore((s) => s.setActiveFamily);
  const { families, createFamily } = useFamilies();

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [famName, setFamName] = useState('');
  const [given, setGiven] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [error, setError] = useState<string>();

  const label = activeFamily
    ? activeFamily.label
    : PRESETS.find((p) => p.id === dataset)?.label ?? 'Demo-familie';

  const choosePreset = (id: DatasetId) => {
    setDataset(id);
    setOpen(false);
  };

  const chooseFamily = (f: (typeof families)[number]) => {
    // Zonder eigen knooppunt (uitgenodigde kijker) kiest de app na laden de
    // eerste persoon als startpunt.
    setActiveFamily({ id: f.id, ego: f.selfPersonId ?? '', label: f.name });
    setOpen(false);
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    try {
      const { familyId, personId } = await createFamily(famName.trim(), given.trim(), familyName.trim());
      setActiveFamily({ id: familyId, ego: personId, label: famName.trim() });
      setCreating(false);
      setOpen(false);
      setFamName('');
      setGiven('');
      setFamilyName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aanmaken mislukt');
    }
  };

  return (
    <div className="family-menu">
      <button className="family-trigger" onClick={() => setOpen((o) => !o)}>
        {label} ▾
      </button>
      {open && (
        <div className="family-pop">
          <div className="family-group">Demo</div>
          {PRESETS.map((p) => (
            <button key={p.id} className="family-item" onClick={() => choosePreset(p.id)}>
              {p.label}
            </button>
          ))}

          {supabase && user && (
            <>
              <div className="family-group">Mijn families</div>
              {families.length === 0 && <div className="family-empty">nog geen eigen boom</div>}
              {families.map((f) => (
                <button key={f.id} className="family-item" onClick={() => chooseFamily(f)}>
                  {f.name}
                  <span className="family-role">{f.role}</span>
                </button>
              ))}

              {creating ? (
                <form className="family-create" onSubmit={onCreate}>
                  <input placeholder="Familienaam (bv. Lai)" value={famName} required
                    onChange={(e) => setFamName(e.target.value)} />
                  <input placeholder="Jouw voornaam" value={given} required
                    onChange={(e) => setGiven(e.target.value)} />
                  <input placeholder="Jouw achternaam" value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)} />
                  <button type="submit">Aanmaken</button>
                  {error && <p className="family-error">{error}</p>}
                </form>
              ) : (
                <button className="family-item family-new" onClick={() => setCreating(true)}>
                  + Nieuwe familieboom
                </button>
              )}
            </>
          )}

          {supabase && !user && <div className="family-empty">log in voor je eigen boom</div>}
        </div>
      )}
    </div>
  );
}
