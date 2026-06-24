import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../data/supabaseClient';
import { copyPersons } from '../data/mutations';
import { useAppStore } from './store';
import { useFamilies } from './useFamilies';
import { useT } from './useT';
import { useVisualViewportOverlay } from './useVisualViewportOverlay';

interface Props {
  /** De boom waar de personen naartoe gekopieerd worden. */
  targetFamilyId: string;
  onClose: () => void;
}

interface SrcPerson {
  id: string;
  label: string;
  sub?: string;
}

/** Kopieer een selectie personen (+ onderlinge relaties) uit een andere eigen boom. */
export function CopyPersons({ targetFamilyId, onClose }: Props) {
  const bumpData = useAppStore((s) => s.bumpData);
  const t = useT();
  const { families } = useFamilies();
  const overlayRef = useVisualViewportOverlay<HTMLDivElement>();

  // Alleen eigen bomen (owner) als bron, en niet de doelboom zelf.
  const sources = families.filter((f) => f.role === 'owner' && f.id !== targetFamilyId);

  const [sourceId, setSourceId] = useState('');
  const [people, setPeople] = useState<SrcPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [doneCount, setDoneCount] = useState<number>();

  useEffect(() => {
    if (!sourceId || !supabase) {
      setPeople([]);
      return;
    }
    setLoading(true);
    setSelected(new Set());
    setQuery('');
    (async () => {
      const { data, error: qErr } = await supabase!
        .from('persons')
        .select('id, given_names, family_name, call_name, birth_year, death_year')
        .eq('family_id', sourceId);
      if (qErr) {
        setError(t.copy.failed);
        setLoading(false);
        return;
      }
      const rows: SrcPerson[] = (data ?? [])
        .map((p) => {
          const main = (p.call_name as string)?.trim() || (p.given_names as string[])?.[0] || '?';
          const label = `${main} ${(p.family_name as string) ?? ''}`.trim();
          const by = p.birth_year as number | null;
          const dy = p.death_year as number | null;
          const sub = by || dy ? `${by ?? ''}–${dy ?? ''}` : undefined;
          return { id: p.id as string, label, sub };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
      setPeople(rows);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? people.filter((p) => p.label.toLowerCase().includes(q)) : people;
  }, [people, query]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const allShownSelected = matches.length > 0 && matches.every((p) => selected.has(p.id));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allShownSelected) matches.forEach((p) => n.delete(p.id));
      else matches.forEach((p) => n.add(p.id));
      return n;
    });

  const copy = async () => {
    if (!sourceId || selected.size === 0) return;
    setBusy(true);
    setError(undefined);
    try {
      const n = await copyPersons(sourceId, targetFamilyId, [...selected]);
      bumpData();
      setDoneCount(n);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.copy.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-overlay" ref={overlayRef} onClick={onClose}>
      <div className="welcome-card import-card" onClick={(e) => e.stopPropagation()}>
        <h2>{t.copy.title}</h2>

        {doneCount != null ? (
          <>
            <p className="welcome-intro">{t.copy.done(doneCount)}</p>
            <div className="welcome-actions">
              <button onClick={onClose}>{t.copy.close}</button>
            </div>
          </>
        ) : sources.length === 0 ? (
          <>
            <p className="welcome-intro">{t.copy.noSources}</p>
            <div className="welcome-actions">
              <button onClick={onClose}>{t.copy.close}</button>
            </div>
          </>
        ) : (
          <>
            <p className="welcome-intro">{t.copy.intro}</p>

            <span className="edit-field-label">{t.copy.sourceLabel}</span>
            <div className="seg-control copy-sources">
              {sources.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`seg-btn${sourceId === f.id ? ' active' : ''}`}
                  onClick={() => setSourceId(f.id)}
                >
                  {f.name}
                </button>
              ))}
            </div>

            {sourceId && (
              <>
                <input
                  className="copy-search"
                  placeholder={t.copy.search}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {loading ? (
                  <p className="welcome-intro">…</p>
                ) : (
                  <>
                    <div className="copy-toolbar">
                      <button type="button" className="link-btn" onClick={toggleAll}>
                        {allShownSelected ? t.copy.deselectAll : t.copy.selectAll}
                      </button>
                      <span className="copy-count">{t.copy.selectedCount(selected.size)}</span>
                    </div>
                    <div className="copy-list">
                      {matches.map((p) => (
                        <label key={p.id} className="copy-row">
                          <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                          <span className="copy-name">{p.label}</span>
                          {p.sub && <span className="copy-sub">{p.sub}</span>}
                        </label>
                      ))}
                      {matches.length === 0 && <div className="family-empty">{t.copy.noMatch}</div>}
                    </div>
                  </>
                )}
              </>
            )}

            {error && <p className="add-rel-error">{error}</p>}
            <div className="welcome-actions">
              <button onClick={copy} disabled={busy || selected.size === 0}>
                {busy ? '…' : t.copy.copyBtn(selected.size)}
              </button>
              <button className="welcome-more" onClick={onClose}>
                {t.copy.cancel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
