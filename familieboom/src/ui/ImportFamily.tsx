import { useEffect, useMemo, useState } from 'react';
import { parseTemplate, TEMPLATE_CSV } from '../data/importTemplate';
import { geocodeImport } from '../data/importGeocode';
import { importFamily, type ImportResult } from '../data/mutations';
import { supabase } from '../data/supabaseClient';
import { useAppStore } from './store';
import { useT } from './useT';

interface Props {
  familyId: string;
  /** Naam van de doelboom — getoond in de titel zodat duidelijk is waar de import in landt. */
  familyName: string;
  onClose: () => void;
}

interface ExistingPerson {
  id: string;
  label: string;
}

/** Bulk-import: plak/upload een platte template, bekijk een preview, bevestig. */
export function ImportFamily({ familyId, familyName, onClose }: Props) {
  const bumpData = useAppStore((s) => s.bumpData);
  const lang = useAppStore((s) => s.lang);
  const t = useT();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<ImportResult>();
  // Voortgang van het geocoderen van plaatsnamen (null = niet bezig).
  const [geo, setGeo] = useState<{ done: number; total: number } | null>(null);
  const [existing, setExisting] = useState<ExistingPerson[]>([]);
  // Koppeling van externe sleutel → bestaand persoon-uuid.
  const [resolved, setResolved] = useState<Record<string, string>>({});

  // Bestaande personen ophalen, zodat verwijzingen naar de huidige boom
  // gekoppeld kunnen worden (RLS laat leden hun familie lezen).
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('persons')
      .select('id, given_names, family_name, birth_year')
      .eq('family_id', familyId)
      .then(({ data }) => {
        const rows = (data ?? []).map((p) => {
          const name = `${p.given_names?.[0] ?? '?'} ${p.family_name ?? ''}`.trim();
          return { id: p.id as string, label: p.birth_year ? `${name} (${p.birth_year})` : name };
        });
        rows.sort((a, b) => a.label.localeCompare(b.label));
        setExisting(rows);
      });
  }, [familyId]);

  const parsed = useMemo(() => (text.trim() ? parseTemplate(text) : undefined), [text]);
  const externalKeys = parsed?.externalKeys ?? [];
  const allResolved = externalKeys.every((k) => resolved[k]);
  const canImport =
    parsed && parsed.errors.length === 0 && parsed.data.persons.length > 0 && allResolved;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setText(await file.text());
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bloom-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    if (!parsed) return;
    setBusy(true);
    setError(undefined);
    try {
      // Eerst plaatsnamen opzoeken (coördinaten), dan atomair importeren.
      const { payload, unresolved } = await geocodeImport(parsed.data, lang, (d, total) =>
        setGeo(total > 0 ? { done: d, total } : null),
      );
      setGeo(null);
      const res = await importFamily(familyId, payload, resolved);
      bumpData();
      setDone(unresolved.length ? { ...res, unresolved } : res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.import.failed);
    } finally {
      setGeo(null);
      setBusy(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="info-card import-card" onClick={(e) => e.stopPropagation()}>
        <div className="info-head">
          <h2>{t.import.title} <span className="panel-title-target">→ {familyName}</span></h2>
          <button className="panel-close" onClick={onClose} aria-label={t.import.close}>×</button>
        </div>

        {done ? (
          <div className="import-done">
            <p>{t.import.doneHead}</p>
            <ul>
              <li>{t.import.persons(done.persons)}</li>
              {done.updated > 0 && <li>{t.import.updated(done.updated)}</li>}
              <li>{t.import.parentLinks(done.parentLinks)}</li>
              <li>{t.import.unions(done.unions)}</li>
            </ul>
            {done.unresolved && done.unresolved.length > 0 && (
              <div className="import-warnings">
                <p>{t.import.unresolvedHead}</p>
                <ul>{done.unresolved.map((n) => <li key={n}>{n}</li>)}</ul>
              </div>
            )}
            <button onClick={onClose}>{t.import.close}</button>
          </div>
        ) : (
          <>
            <p className="info-intro import-intro">{t.import.intro}</p>
            <div className="import-actions-top">
              <button className="link-btn" onClick={downloadTemplate}>{t.import.downloadTemplate}</button>
              <label className="link-btn file-label">
                {t.import.chooseFile}
                <input type="file" accept=".csv,.tsv,.txt" onChange={onFile} hidden />
              </label>
            </div>

            <textarea
              className="import-textarea"
              placeholder={t.import.textarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />

            {parsed && (
              <div className="import-preview">
                <div className="import-counts">
                  <span>{t.import.persons(parsed.data.persons.length)}</span>
                  <span>{t.import.countParent(parsed.data.parentLinks.length)}</span>
                  <span>{t.import.unions(parsed.data.unions.length)}</span>
                </div>
                {parsed.errors.length > 0 && (
                  <ul className="import-errors">
                    {parsed.errors.slice(0, 12).map((m, i) => <li key={i}>{m}</li>)}
                    {parsed.errors.length > 12 && <li>{t.import.andMore(parsed.errors.length - 12)}</li>}
                  </ul>
                )}
                {parsed.warnings.length > 0 && (
                  <ul className="import-warnings">
                    {parsed.warnings.slice(0, 8).map((m, i) => <li key={i}>{m}</li>)}
                    {parsed.warnings.length > 8 && <li>{t.import.andMore(parsed.warnings.length - 8)}</li>}
                  </ul>
                )}

                {externalKeys.length > 0 && (
                  <div className="import-resolve">
                    <p className="import-resolve-head">{t.import.resolveHead}</p>
                    {externalKeys.map((k) => (
                      <label key={k} className="import-resolve-row">
                        <code>{k}</code>
                        <select
                          value={resolved[k] ?? ''}
                          onChange={(e) =>
                            setResolved((r) => ({ ...r, [k]: e.target.value }))
                          }
                        >
                          <option value="">{t.import.choosePerson}</option>
                          {existing.map((p) => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && <p className="import-error-msg">{error}</p>}

            {geo && (
              <p className="import-geo-progress">{t.import.geocoding} {geo.done}/{geo.total}</p>
            )}

            <div className="import-actions">
              <button disabled={!canImport || busy} onClick={runImport}>
                {geo
                  ? `${t.import.geocoding} ${geo.done}/${geo.total}`
                  : busy
                    ? t.import.importing
                    : parsed
                      ? t.import.importN(parsed.data.persons.length)
                      : t.import.importBtn}
              </button>
              <button className="add-rel-cancel" onClick={onClose}>{t.import.cancel}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
