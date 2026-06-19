import { useEffect, useRef, useState } from 'react';
import { supabase } from '../data/supabaseClient';
import { LAST_FAMILY_KEY, useAppStore, type DatasetId } from './store';
import { useFamilies } from './useFamilies';
import { useT } from './useT';
import { ImportFamily } from './ImportFamily';

const PRESET_IDS: DatasetId[] = ['demo', 'habsburg'];

/** Bron-keuze: demo-presets, je eigen families, of een nieuwe boom aanmaken. */
export function FamilyMenu() {
  const dataset = useAppStore((s) => s.dataset);
  const activeFamily = useAppStore((s) => s.activeFamily);
  const user = useAppStore((s) => s.user);
  const setDataset = useAppStore((s) => s.setDataset);
  const setActiveFamily = useAppStore((s) => s.setActiveFamily);
  const t = useT();
  const { families, createFamily } = useFamilies();
  const presetLabel = (id: DatasetId) => (id === 'habsburg' ? t.family.presetHabsburg : t.family.presetDemo);

  // Open na inloggen meteen je eigen boom i.p.v. de demo (één keer): de laatst
  // geopende, of anders de eerste. Zo hoeft een nieuwe genodigde niet zelf het
  // menu te zoeken om bij zijn familie te komen.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || activeFamily || !user || families.length === 0) return;
    restored.current = true;
    const lastId = localStorage.getItem(LAST_FAMILY_KEY);
    const f = families.find((x) => x.id === lastId) ?? families[0];
    setActiveFamily({ id: f.id, ego: f.selfPersonId ?? '', label: f.name });
  }, [families, user, activeFamily, setActiveFamily]);

  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [famName, setFamName] = useState('');
  const [given, setGiven] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [error, setError] = useState<string>();

  const label = activeFamily ? activeFamily.label : presetLabel(dataset);

  // Bulk-import alleen voor de eigenaar van de actieve familie (RPC dwingt dit
  // ook af, maar zo tonen we de knop alleen waar 'ie zin heeft).
  const canImport = !!activeFamily && families.find((f) => f.id === activeFamily.id)?.role === 'owner';

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
      setError(err instanceof Error ? err.message : t.family.createFailed);
    }
  };

  return (
    <div className="family-menu">
      <button className="family-trigger" onClick={() => setOpen((o) => !o)}>
        {label} ▾
      </button>
      {open && (
        <div className="family-pop">
          <div className="family-group">{t.family.demo}</div>
          {PRESET_IDS.map((pid) => (
            <button key={pid} className="family-item" onClick={() => choosePreset(pid)}>
              {presetLabel(pid)}
            </button>
          ))}

          {supabase && user && (
            <>
              <div className="family-group">{t.family.mine}</div>
              {families.length === 0 && <div className="family-empty">{t.family.noOwn}</div>}
              {families.map((f) => (
                <button key={f.id} className="family-item" onClick={() => chooseFamily(f)}>
                  {f.name}
                  <span className="family-role">{f.role}</span>
                </button>
              ))}

              {creating ? (
                <form className="family-create" onSubmit={onCreate}>
                  <input placeholder={t.family.namePlaceholder} value={famName} required
                    onChange={(e) => setFamName(e.target.value)} />
                  <input placeholder={t.family.yourFirstName} value={given} required
                    onChange={(e) => setGiven(e.target.value)} />
                  <input placeholder={t.family.yourLastName} value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)} />
                  <button type="submit">{t.family.create}</button>
                  {error && <p className="family-error">{error}</p>}
                </form>
              ) : (
                <button className="family-item family-new" onClick={() => setCreating(true)}>
                  {t.family.newTree}
                </button>
              )}

              {canImport && (
                <button
                  className="family-item family-import"
                  onClick={() => { setImporting(true); setOpen(false); }}
                >
                  {t.family.importPeople}
                </button>
              )}
            </>
          )}

          {supabase && !user && <div className="family-empty">{t.family.loginForOwn}</div>}
        </div>
      )}

      {importing && activeFamily && (
        <ImportFamily familyId={activeFamily.id} onClose={() => setImporting(false)} />
      )}
    </div>
  );
}
