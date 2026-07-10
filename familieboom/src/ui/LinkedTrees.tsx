import { useState } from 'react';
import { useAppStore } from './store';
import { useT } from './useT';

export interface LinkedCandidate {
  id: string;
  name: string;
}

interface Props {
  /** Gekoppelde families (afgeleid uit de brugpersonen in de actieve boom). */
  candidates: LinkedCandidate[];
  /** Families waar de gebruiker toegang toe heeft (lid van is). */
  accessibleIds: string[];
  /** Toegang aanvragen voor een familie zonder toegang. */
  onRequestAccess: (familyId: string, familyName: string) => void;
}

/**
 * Kiezer voor de samengevoegde weergave: vink aan welke gekoppelde familiebomen
 * tegelijk met de actieve boom getoond worden. De grafen worden dan op de
 * brugpersonen aan elkaar genaaid (mergeGraphs). Leeg = alleen de eigen boom.
 *
 * Families zonder toegang staan grijs met een "toegang vragen"-knop: de brug is
 * zichtbaar voor elk familielid, maar de inhoud blijft afgeschermd tot de owner
 * van die familie het lidmaatschap goedkeurt.
 */
export function LinkedTrees({ candidates, accessibleIds, onRequestAccess }: Props) {
  const t = useT();
  const linkedFamilyIds = useAppStore((s) => s.linkedFamilyIds);
  const toggleLinkedFamily = useAppStore((s) => s.toggleLinkedFamily);
  const [open, setOpen] = useState(false);

  if (candidates.length === 0) return null;
  const activeCount = candidates.filter((c) => linkedFamilyIds.includes(c.id)).length;

  return (
    <div className="linked-trees">
      <button
        className={`linked-trees-btn${activeCount > 0 ? ' active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        ⌘ {t.tree.linkedButton}{activeCount > 0 ? ` · ${activeCount}` : ''}
      </button>
      {open && (
        <>
          <div className="linked-trees-backdrop" onClick={() => setOpen(false)} />
          <div className="linked-trees-pop" role="group" aria-label={t.tree.linkedLabel}>
            <p className="linked-trees-hint">{t.tree.linkedHint}</p>
            {candidates.map((c) => {
              const hasAccess = accessibleIds.includes(c.id);
              if (!hasAccess) {
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="linked-trees-row no-access"
                    title={t.tree.linkedNoAccess}
                    onClick={() => onRequestAccess(c.id, c.name)}
                  >
                    <span className="linked-trees-name">{c.name}</span>
                    <span className="linked-trees-request">{t.tree.linkedRequest}</span>
                  </button>
                );
              }
              return (
                <label key={c.id} className="linked-trees-row">
                  <input
                    type="checkbox"
                    checked={linkedFamilyIds.includes(c.id)}
                    onChange={() => toggleLinkedFamily(c.id)}
                  />
                  <span className="linked-trees-name">{c.name}</span>
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
