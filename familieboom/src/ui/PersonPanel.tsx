import type { FamilyGraph, Person } from '../data/types';
import { claimSelfPerson } from '../data/invites';
import { AddRelative } from './AddRelative';
import { BridgeSection } from './BridgeSection';
import { EditPerson } from './EditPerson';
import { RelationsEditor } from './RelationsEditor';
import { useAppStore } from './store';
import { shortName } from './theme';

interface Props {
  person: Person;
  familyId: string;
  egoId: string;
  graph: FamilyGraph | undefined;
  onClose: () => void;
}

/** Eén georganiseerd bewerk-paneel: gegevens, relaties en toevoegen. */
export function PersonPanel({ person, familyId, egoId, graph, onClose }: Props) {
  const activeFamily = useAppStore((s) => s.activeFamily);
  const setActiveFamily = useAppStore((s) => s.setActiveFamily);
  const setNotice = useAppStore((s) => s.setNotice);
  const isSelf = person.id === egoId;

  const claimSelf = async () => {
    if (!activeFamily) return;
    try {
      await claimSelfPerson(activeFamily.id, person.id);
      setActiveFamily({ ...activeFamily, ego: person.id }); // meteen jouw perspectief
      setNotice(`Je bent nu gekoppeld aan ${shortName(person)} — dit is je perspectief.`);
      onClose();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Koppelen mislukt');
    }
  };

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="person-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <strong>{shortName(person)}</strong>
          <button className="panel-close" onClick={onClose} aria-label="Sluiten">
            ×
          </button>
        </div>

        {!isSelf && !person.hidden && (
          <button className="claim-self" onClick={claimSelf} title="Koppel je account aan deze persoon">
            dit ben ik
          </button>
        )}

        <section className="panel-section">
          <div className="panel-label">Gegevens</div>
          <EditPerson person={person} egoId={egoId} embedded />
        </section>

        <section className="panel-section">
          <div className="panel-label">Relaties</div>
          <RelationsEditor person={person} graph={graph} embedded />
        </section>

        <section className="panel-section">
          <div className="panel-label">Toevoegen</div>
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
