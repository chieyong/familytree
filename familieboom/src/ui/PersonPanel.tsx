import type { FamilyGraph, Person } from '../data/types';
import { claimSelfPerson } from '../data/invites';
import { AddRelative } from './AddRelative';
import { BridgeSection } from './BridgeSection';
import { EditPerson } from './EditPerson';
import { RelationsEditor } from './RelationsEditor';
import { useAppStore } from './store';
import { useT } from './useT';
import { lifespan, shortName } from './theme';

interface Props {
  person: Person;
  familyId: string;
  egoId: string;
  graph: FamilyGraph | undefined;
  /** Ondertekende profielfoto-URL (uit App, geen extra fetch nodig). */
  photoUrl?: string;
  onClose: () => void;
}

/** Eén georganiseerd bewerk-paneel: gegevens, relaties en toevoegen. */
export function PersonPanel({ person, familyId, egoId, graph, photoUrl, onClose }: Props) {
  const activeFamily = useAppStore((s) => s.activeFamily);
  const setActiveFamily = useAppStore((s) => s.setActiveFamily);
  const setNotice = useAppStore((s) => s.setNotice);
  const t = useT();
  const isSelf = person.id === egoId;

  const claimSelf = async () => {
    if (!activeFamily) return;
    try {
      await claimSelfPerson(activeFamily.id, person.id);
      setActiveFamily({ ...activeFamily, ego: person.id }); // meteen jouw perspectief
      setNotice(t.panel.claimed(shortName(person)));
      onClose();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t.panel.claimFailed);
    }
  };

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="person-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div className="panel-id">
            {photoUrl && <img className="panel-avatar" src={photoUrl} alt="" />}
            <div className="panel-id-text">
              <strong>{shortName(person)}</strong>
              {lifespan(person) && <span className="panel-years">{lifespan(person)}</span>}
            </div>
          </div>
          <button className="panel-close" onClick={onClose} aria-label="Sluiten">
            ×
          </button>
        </div>

        {!isSelf && !person.hidden && (
          <button className="claim-self" onClick={claimSelf} title={t.panel.thisIsMeTitle}>
            {t.panel.thisIsMe}
          </button>
        )}

        <section className="panel-section">
          <div className="panel-label">{t.panel.sectionData}</div>
          <EditPerson person={person} egoId={egoId} />
        </section>

        <section className="panel-section">
          <div className="panel-label">{t.panel.sectionRelations}</div>
          <RelationsEditor person={person} graph={graph} />
        </section>

        <section className="panel-section">
          <div className="panel-label">{t.panel.sectionAdd}</div>
          <AddRelative
            familyId={familyId}
            anchorId={person.id}
            anchorName={person.givenNames[0] ?? 'deze persoon'}
            candidates={graph?.persons ?? []}
          />
        </section>

        <BridgeSection person={person} familyId={familyId} />
      </div>
    </div>
  );
}
