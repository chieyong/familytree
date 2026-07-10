import { useState } from 'react';
import type { FamilyGraph, Person } from '../data/types';
import { useVisualViewportOverlay } from './useVisualViewportOverlay';
import { claimSelfPerson } from '../data/invites';
import { submitPersonProposal, submitRelativeProposal, type PersonEdit } from '../data/mutations';
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
  /** Owner/editor mag bewerken; viewers krijgen alleen-lezen. */
  canEdit?: boolean;
  /** Bijdrager mag wijzigingen voorstellen (niet direct opslaan). */
  canPropose?: boolean;
  onClose: () => void;
}

/**
 * Detailpaneel: toont eerst alle gegevens + relaties (alleen-lezen). Pas op
 * "bewerken" verschijnen de bewerkbare velden, relaties en toevoeg-acties.
 */
export function PersonPanel({ person, familyId, egoId, graph, photoUrl, canEdit, canPropose, onClose }: Props) {
  const activeFamily = useAppStore((s) => s.activeFamily);
  const setActiveFamily = useAppStore((s) => s.setActiveFamily);
  const setNotice = useAppStore((s) => s.setNotice);
  const user = useAppStore((s) => s.user);
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [proposing, setProposing] = useState(false);

  const submitProposal = async (e: PersonEdit) => {
    await submitPersonProposal(familyId, person.id, e, shortName(person), user?.email ?? '');
    setProposing(false);
    setNotice(t.proposal.sent);
    onClose();
  };

  const submitRelProposal = async (
    kind: 'person_add' | 'relation_add',
    payload: Record<string, unknown>,
    summary: string,
  ) => {
    await submitRelativeProposal(familyId, person.id, kind, payload, summary, user?.email ?? '');
    setNotice(t.proposal.sent);
  };
  // True zodra in AddRelative een relatietype is gekozen: dan klapt de rest van
  // het paneel in en zie je alleen de invoervelden van de nieuwe persoon.
  const [adding, setAdding] = useState(false);
  const overlayRef = useVisualViewportOverlay<HTMLDivElement>();
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
  // Volledige voornamen tonen wanneer er een roepnaam is die ervan afwijkt
  // (anders staat dezelfde naam al als hoofd-label boven het paneel).
  const fullNames = person.givenNames.join(' ').trim();
  const callName = person.callName?.trim();
  const showFullNames = !!callName && !!fullNames && fullNames !== callName;
  const birthPlace = person.birth?.place?.name;
  const deathPlace = person.death?.place?.name;

  return (
    <div className="panel-overlay" ref={overlayRef} onClick={onClose}>
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

        {proposing ? (
          <>
            <section className="panel-section">
              <div className="panel-label">{t.proposal.sectionPropose}</div>
              <p className="bridge-hint">{t.proposal.hint}</p>
              <EditPerson person={person} egoId={egoId} embedded proposalMode onSubmitProposal={submitProposal} />
            </section>

            <section className="panel-section">
              <div className="panel-label">{t.panel.sectionAdd}</div>
              <AddRelative
                familyId={familyId}
                anchorId={person.id}
                anchorName={person.givenNames[0] ?? 'deze persoon'}
                candidates={graph?.persons ?? []}
                proposalMode
                onSubmitProposal={submitRelProposal}
              />
            </section>

            <button className="panel-done" onClick={() => setProposing(false)}>{t.edit.cancel}</button>
          </>
        ) : editing ? (
          <>
            {!adding && (
              <section className="panel-section">
                <div className="panel-label">{t.panel.sectionData}</div>
                <EditPerson person={person} egoId={egoId} embedded />
              </section>
            )}

            {!adding && (
              <section className="panel-section">
                <div className="panel-label">{t.panel.sectionRelations}</div>
                <RelationsEditor person={person} graph={graph} embedded />
              </section>
            )}

            <section className="panel-section">
              <div className="panel-label">{t.panel.sectionAdd}</div>
              <AddRelative
                familyId={familyId}
                anchorId={person.id}
                anchorName={person.givenNames[0] ?? 'deze persoon'}
                candidates={graph?.persons ?? []}
                onAddingChange={setAdding}
              />
            </section>

            {!adding && <BridgeSection person={person} familyId={familyId} />}

            {!adding && (
              <button className="panel-done" onClick={() => setEditing(false)}>{t.panel.done}</button>
            )}
          </>
        ) : (
          <>
            {(showFullNames || nativeSubline(person) || (person.nicknames?.length && person.preferredName !== 'nickname') || birthPlace || deathPlace || sexLabel || visLabel) && (
              <div className="panel-details">
                {showFullNames && <div className="pd-fullnames">{t.edit.firstName}: {fullNames}</div>}
                {nativeSubline(person) && <div className="pd-native">{nativeSubline(person)}</div>}
                {person.nicknames?.length && person.preferredName !== 'nickname' ? (
                  <div className="pd-nick">{person.nicknames.map((n) => `‘${n}’`).join(' ')}</div>
                ) : null}
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

            {activeFamily && canEdit && (
              <button className="panel-edit" onClick={() => setEditing(true)}>✎ {t.edit.edit}</button>
            )}
            {activeFamily && !canEdit && canPropose && (
              <button className="panel-edit" onClick={() => setProposing(true)}>✎ {t.proposal.propose}</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
