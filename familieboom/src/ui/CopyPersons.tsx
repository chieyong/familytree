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
  key: string; // naam+geboortejaar, voor matching met de doelboom
}

interface Anchor {
  anchorId: string; // bron-persoon (niet geselecteerd) die ook in de doelboom staat
  targetId: string; // het bestaande knooppunt in de doelboom
  label: string;
}

/** Naam+geboortejaar-sleutel voor het matchen van "dezelfde" persoon tussen bomen. */
function matchKey(givenNames: string[] | null, callName: string | null, familyName: string | null, birthYear: number | null) {
  const main = (callName?.trim() || givenNames?.[0] || '').toLowerCase().trim();
  return `${main}|${(familyName ?? '').toLowerCase().trim()}#${birthYear ?? ''}`;
}

/** Kopieer een selectie personen (+ onderlinge relaties) uit een andere eigen boom. */
export function CopyPersons({ targetFamilyId, onClose }: Props) {
  const bumpData = useAppStore((s) => s.bumpData);
  const t = useT();
  const { families } = useFamilies();
  const overlayRef = useVisualViewportOverlay<HTMLDivElement>();

  const sources = families.filter((f) => f.role === 'owner' && f.id !== targetFamilyId);

  const [sourceId, setSourceId] = useState('');
  const [people, setPeople] = useState<SrcPerson[]>([]);
  const [unions, setUnions] = useState<[string, string][]>([]);
  const [parentLinks, setParentLinks] = useState<[string, string][]>([]);
  const [targetIndex, setTargetIndex] = useState<Map<string, { id: string; label: string }>>(new Map());
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [disabledAnchors, setDisabledAnchors] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [doneCount, setDoneCount] = useState<number>();

  // Doelboom-personen één keer ophalen → index op naam+geboortejaar voor matching.
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase!
        .from('persons')
        .select('id, given_names, family_name, call_name, birth_year')
        .eq('family_id', targetFamilyId);
      const idx = new Map<string, { id: string; label: string }>();
      for (const p of data ?? []) {
        const key = matchKey(p.given_names as string[], p.call_name as string, p.family_name as string, p.birth_year as number);
        if (idx.has(key)) continue; // eerste match wint
        const main = (p.call_name as string)?.trim() || (p.given_names as string[])?.[0] || '?';
        idx.set(key, { id: p.id as string, label: `${main} ${(p.family_name as string) ?? ''}`.trim() });
      }
      setTargetIndex(idx);
    })();
  }, [targetFamilyId]);

  // Bron-personen + relaties laden wanneer een bron gekozen is.
  useEffect(() => {
    if (!sourceId || !supabase) {
      setPeople([]); setUnions([]); setParentLinks([]);
      return;
    }
    setLoading(true);
    setSelected(new Set());
    setDisabledAnchors(new Set());
    setQuery('');
    (async () => {
      const [pr, ur, plr] = await Promise.all([
        supabase!.from('persons').select('id, given_names, family_name, call_name, birth_year, death_year').eq('family_id', sourceId),
        supabase!.from('unions').select('partner_a, partner_b').eq('family_id', sourceId),
        supabase!.from('parent_links').select('parent_id, child_id').eq('family_id', sourceId),
      ]);
      if (pr.error) {
        setError(t.copy.failed); setLoading(false); return;
      }
      const rows: SrcPerson[] = (pr.data ?? [])
        .map((p) => {
          const main = (p.call_name as string)?.trim() || (p.given_names as string[])?.[0] || '?';
          const label = `${main} ${(p.family_name as string) ?? ''}`.trim();
          const by = p.birth_year as number | null;
          const dy = p.death_year as number | null;
          const sub = by || dy ? `${by ?? ''}–${dy ?? ''}` : undefined;
          const key = matchKey(p.given_names as string[], p.call_name as string, p.family_name as string, by);
          return { id: p.id as string, label, sub, key };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
      setPeople(rows);
      setUnions((ur.data ?? []).map((u) => [u.partner_a as string, u.partner_b as string]));
      setParentLinks((plr.data ?? []).map((l) => [l.parent_id as string, l.child_id as string]));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? people.filter((p) => p.label.toLowerCase().includes(q)) : people;
  }, [people, query]);

  // Grenspersonen: verwant aan een geselecteerde persoon, zelf niet geselecteerd,
  // én herkend (naam+geboortejaar) in de doelboom → kandidaat om aan te knopen.
  const anchors = useMemo<Anchor[]>(() => {
    const cand = new Set<string>();
    const consider = (a: string, b: string) => {
      if (selected.has(a) && !selected.has(b)) cand.add(b);
      if (selected.has(b) && !selected.has(a)) cand.add(a);
    };
    unions.forEach(([a, b]) => consider(a, b));
    parentLinks.forEach(([a, b]) => consider(a, b));
    const out: Anchor[] = [];
    for (const id of cand) {
      const sp = byId.get(id);
      if (!sp) continue;
      const tgt = targetIndex.get(sp.key);
      if (tgt) out.push({ anchorId: id, targetId: tgt.id, label: tgt.label });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [selected, unions, parentLinks, byId, targetIndex]);

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const allShownSelected = matches.length > 0 && matches.every((p) => selected.has(p.id));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allShownSelected) matches.forEach((p) => n.delete(p.id));
      else matches.forEach((p) => n.add(p.id));
      return n;
    });

  const toggleAnchor = (id: string) =>
    setDisabledAnchors((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const copy = async () => {
    if (!sourceId || selected.size === 0) return;
    const anchorMap: Record<string, string> = {};
    anchors.forEach((a) => { if (!disabledAnchors.has(a.anchorId)) anchorMap[a.anchorId] = a.targetId; });
    setBusy(true);
    setError(undefined);
    try {
      const n = await copyPersons(sourceId, targetFamilyId, [...selected], anchorMap);
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
            <div className="welcome-actions"><button onClick={onClose}>{t.copy.close}</button></div>
          </>
        ) : sources.length === 0 ? (
          <>
            <p className="welcome-intro">{t.copy.noSources}</p>
            <div className="welcome-actions"><button onClick={onClose}>{t.copy.close}</button></div>
          </>
        ) : (
          <>
            <p className="welcome-intro">{t.copy.intro}</p>

            <span className="edit-field-label">{t.copy.sourceLabel}</span>
            <div className="seg-control copy-sources">
              {sources.map((f) => (
                <button key={f.id} type="button"
                  className={`seg-btn${sourceId === f.id ? ' active' : ''}`}
                  onClick={() => setSourceId(f.id)}>
                  {f.name}
                </button>
              ))}
            </div>

            {sourceId && (
              <>
                <input className="copy-search" placeholder={t.copy.search}
                  value={query} onChange={(e) => setQuery(e.target.value)} />
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

                    {anchors.length > 0 && (
                      <div className="copy-anchors">
                        <span className="edit-field-label">{t.copy.linkLabel}</span>
                        <p className="copy-anchor-hint">{t.copy.linkHint}</p>
                        {anchors.map((a) => (
                          <label key={a.anchorId} className="copy-row">
                            <input type="checkbox" checked={!disabledAnchors.has(a.anchorId)}
                              onChange={() => toggleAnchor(a.anchorId)} />
                            <span className="copy-name">{a.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {error && <p className="add-rel-error">{error}</p>}
            <div className="welcome-actions">
              <button onClick={copy} disabled={busy || selected.size === 0}>
                {busy ? '…' : t.copy.copyBtn(selected.size)}
              </button>
              <button className="welcome-more" onClick={onClose}>{t.copy.cancel}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
