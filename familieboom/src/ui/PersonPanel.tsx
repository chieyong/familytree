import { useState } from 'react';
import type { FamilyGraph, Person } from '../data/types';
import { claimSelfPerson } from '../data/invites';
import { AddRelative } from './AddRelative';
import { BridgeSection } from './BridgeSection';
import { EditPerson } from './EditPerson';
import { RelationsEditor } from './RelationsEditor';
import { useAppStore } from './store';
import { useT } from './useT';
import { lifespan, nativeSubline, shortName } from './theme';

interface Props {
  person: Person;
  familyId: string;
  egoId: string;
  graph: FamilyGraph | undefined;
  /** Ondertekende profielfoto-URL (uit App, geen extra fetch nodig). */
  photoUrl?: string;
  onClose: () => void;
}

/**
 * Detailpaneel: toont eerst alle gegevens + relaties (alleen-lezen). Pas op
 * "bewerken" verschijnen de bewerkbare velden, relaties en toevoeg-acties.
 */
export function PersonPanel({ person, familyId, egoId, graph, photoUrl, onClose }: Props) {
  const activeFamily = useAppStore((s) => s.activeFamily);
  const setActiveFamily = useAppStore((s) => s.setActiveFamily);
  const setNotice = useAppStore((s) => s.setNotice);
  const t = useT();
  const [editing, setEditing] = useState(false);
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

  const sexLabel =
    person.sex === 'm' ? t.edit.sexM : person.sex === 'f' ? t.edit.sexF : person.sex === 'x' ? t.edit.sexX : undefined;
  const visLabel =
    person.visibility === 'private' ? t.edit.visPrivate : person.visibility === 'public' ? t.edit.visPublic : undefined;
  const birthPlace = person.birth?.place?.name;
  const deathPlace = person.death?.place?.name;

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

        {editing ? (
          <>
            <section className="panel-section">
              <div className="panel-label">{t.panel.sectionData}</div>
              <EditPerson person={person} egoId={egoId} embedded />
            </section>

            <section className="panel-section">
              <div className="panel-label">{t.panel.sectionRelations}</div>
              <RelationsEditor person={person} graph={graph} embedded />
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

            <button className="panel-done" onClick={() => setEditing(false)}>{t.panel.done}</button>
          </>
        ) : (
          <>
            {(nativeSubline(person) || (person.nickname && person.preferredName !== 'nickname') || birthPlace || deathPlace || sexLabel || visLabel) && (
              <div className="panel-details">
                {nativeSubline(person) && <div className="pd-native">{nativeSubline(person)}</div>}
                {person.nickname && person.preferredName !== 'nickname' && <div className="pd-nick">‘{person.nickname}’</div>}
                {(birthPlace || deathPlace) && (
                  <div className="pd-places">
                    {birthPlace && <span>° {birthPlace}</span>}
                    {deathPlace && <span>† {deathPlace}</span>}
                  </div>
                )}
                {(sexLabel || visLabel) && (
                  <div className="pd-chips">
                    {sexLabel && <span className="pd-chip">{sexLabel}</span>}
                    {visLabel && <span className="pd-chip">{visLabel}</span>}
                  </div>
                )}
              </div>
            )}

            <section className="panel-section">
              <div className="panel-label">{t.panel.sectionRelations}</div>
              <RelationsEditor person={person} graph={graph} readOnly />
            </section>

            {person.bridge && (
              <p className="bridge-linked">{t.bridge.linked(person.bridge.familyName)}</p>
            )}

            {activeFamily && (
              <button className="panel-edit" onClick={() => setEditing(true)}>✎ {t.edit.edit}</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
