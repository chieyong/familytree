import type { FamilyGraph, Person } from '../data/types';
import { AddRelative } from './AddRelative';
import { EditPerson } from './EditPerson';
import { RelationsEditor } from './RelationsEditor';
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
  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="person-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <strong>{shortName(person)}</strong>
          <button className="panel-close" onClick={onClose} aria-label="Sluiten">
            ×
          </button>
        </div>

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
      </div>
    </div>
  );
}
