import { useMemo, useState } from 'react';
import { parseTemplate, TEMPLATE_CSV } from '../data/importTemplate';
import { importFamily, type ImportResult } from '../data/mutations';
import { useAppStore } from './store';

interface Props {
  familyId: string;
  onClose: () => void;
}

/** Bulk-import: plak/upload een platte template, bekijk een preview, bevestig. */
export function ImportFamily({ familyId, onClose }: Props) {
  const bumpData = useAppStore((s) => s.bumpData);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<ImportResult>();

  const parsed = useMemo(() => (text.trim() ? parseTemplate(text) : undefined), [text]);
  const canImport = parsed && parsed.errors.length === 0 && parsed.data.persons.length > 0;

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
      const res = await importFamily(familyId, parsed.data);
      bumpData();
      setDone(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import mislukt');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="info-card import-card" onClick={(e) => e.stopPropagation()}>
        <div className="info-head">
          <h2>Personen importeren</h2>
          <button className="panel-close" onClick={onClose} aria-label="Sluiten">×</button>
        </div>

        {done ? (
          <div className="import-done">
            <p>Klaar — toegevoegd:</p>
            <ul>
              <li>{done.persons} personen</li>
              <li>{done.parentLinks} ouder-kind-relaties</li>
              <li>{done.unions} partnerschappen</li>
            </ul>
            <button onClick={onClose}>Sluiten</button>
          </div>
        ) : (
          <>
            <p className="info-intro import-intro">
              Eén regel per persoon. Geef elke persoon een eigen <code>id</code> (sleutel) en
              verwijs daarnaar met <code>vader_id</code>, <code>moeder_id</code> en{' '}
              <code>partner_id</code>. Nuances als scheiding of adoptie zet je daarna met de hand bij.
            </p>
            <div className="import-actions-top">
              <button className="link-btn" onClick={downloadTemplate}>↓ voorbeeld-template (.csv)</button>
              <label className="link-btn file-label">
                ⬆ bestand kiezen
                <input type="file" accept=".csv,.tsv,.txt" onChange={onFile} hidden />
              </label>
            </div>

            <textarea
              className="import-textarea"
              placeholder="Plak hier je tabel (vanuit Excel/Google Sheets) of upload een CSV…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />

            {parsed && (
              <div className="import-preview">
                <div className="import-counts">
                  <span>{parsed.data.persons.length} personen</span>
                  <span>{parsed.data.parentLinks.length} ouder-kind</span>
                  <span>{parsed.data.unions.length} partnerschappen</span>
                </div>
                {parsed.errors.length > 0 && (
                  <ul className="import-errors">
                    {parsed.errors.slice(0, 12).map((m, i) => <li key={i}>{m}</li>)}
                    {parsed.errors.length > 12 && <li>…en nog {parsed.errors.length - 12}.</li>}
                  </ul>
                )}
                {parsed.warnings.length > 0 && (
                  <ul className="import-warnings">
                    {parsed.warnings.slice(0, 8).map((m, i) => <li key={i}>{m}</li>)}
                    {parsed.warnings.length > 8 && <li>…en nog {parsed.warnings.length - 8}.</li>}
                  </ul>
                )}
              </div>
            )}

            {error && <p className="import-error-msg">{error}</p>}

            <div className="import-actions">
              <button disabled={!canImport || busy} onClick={runImport}>
                {busy ? 'Bezig…' : parsed ? `Importeer ${parsed.data.persons.length} personen` : 'Importeer'}
              </button>
              <button className="add-rel-cancel" onClick={onClose}>annuleer</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
