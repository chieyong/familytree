import { useState } from 'react';
import { resolveProposal, type Proposal } from '../data/mutations';
import { useT } from './useT';
import { useVisualViewportOverlay } from './useVisualViewportOverlay';

interface Props {
  proposals: Proposal[];
  onClose: () => void;
  /** Na goed-/afkeuren: laat App de lijst + graaf herladen. */
  onResolved: () => void;
}

/** Owner/editor bekijkt open voorstellen en keurt ze goed of af. */
export function ProposalsReview({ proposals, onClose, onResolved }: Props) {
  const t = useT();
  const overlayRef = useVisualViewportOverlay<HTMLDivElement>();
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();

  const resolve = async (id: string, approve: boolean) => {
    setBusyId(id);
    setError(undefined);
    try {
      await resolveProposal(id, approve);
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.proposal.resolveFailed);
    } finally {
      setBusyId(undefined);
    }
  };

  const proposed = (p: Proposal) => {
    const pl = p.payload;
    const given = Array.isArray(pl.given_names) ? (pl.given_names as string[]).join(' ') : '';
    const name = `${given} ${(pl.family_name as string) ?? ''}`.trim();
    const call = pl.call_name ? `‘${pl.call_name as string}’` : '';
    const years = pl.birth_year || pl.death_year ? `${(pl.birth_year as number) ?? ''}–${(pl.death_year as number) ?? ''}` : '';
    return [name, call, years].filter(Boolean).join(' · ');
  };

  return (
    <div className="auth-overlay" ref={overlayRef} onClick={onClose}>
      <div className="welcome-card import-card" onClick={(e) => e.stopPropagation()}>
        <h2>{t.proposal.reviewTitle}</h2>

        {proposals.length === 0 ? (
          <p className="welcome-intro">{t.proposal.none}</p>
        ) : (
          <div className="proposal-list">
            {proposals.map((p) => (
              <div key={p.id} className="proposal-item">
                <div className="proposal-head">
                  <strong>{p.summary}</strong>
                  {p.authorLabel && <span className="proposal-author">{t.proposal.by(p.authorLabel)}</span>}
                </div>
                <span className="proposal-kind">
                  {p.kind === 'person_add' ? t.proposal.kindAdd
                    : p.kind === 'relation_add' ? t.proposal.kindLink
                    : t.proposal.kindUpdate}
                </span>
                <div className="proposal-fields">{proposed(p)}</div>
                <div className="proposal-actions">
                  <button disabled={busyId === p.id} onClick={() => resolve(p.id, true)}>
                    {t.proposal.approve}
                  </button>
                  <button className="welcome-more" disabled={busyId === p.id} onClick={() => resolve(p.id, false)}>
                    {t.proposal.reject}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p className="add-rel-error">{error}</p>}
        <div className="welcome-actions">
          <button onClick={onClose}>{t.proposal.close}</button>
        </div>
      </div>
    </div>
  );
}
