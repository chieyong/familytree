import { useEffect, useState } from 'react';
import { approveMember, createInvite, listMembers, removeMember, type Member } from '../data/invites';
import { useAppStore } from './store';

/** Owner/editor: deel de actieve familie (uitnodigingslink) en keur leden goed. */
export function ShareFamily() {
  const activeFamily = useAppStore((s) => s.activeFamily);
  const user = useAppStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [link, setLink] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor'>('viewer');
  const [error, setError] = useState<string>();

  const refetch = async () => {
    if (!activeFamily) return;
    try {
      setMembers(await listMembers(activeFamily.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden mislukt');
    }
  };

  useEffect(() => {
    if (open) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeFamily?.id]);

  if (!activeFamily || !user) return null;
  const myRole = members.find((m) => m.profileId === user.id)?.role;
  const canInvite = myRole === 'owner' || myRole === 'editor';
  const isOwner = myRole === 'owner';

  const makeLink = async () => {
    setError(undefined);
    try {
      // Alleen de owner mag een rol kiezen; een editor nodigt altijd lezers uit
      // (geen rechten-escalatie via de link).
      const role = isOwner ? inviteRole : 'viewer';
      const token = await createInvite(activeFamily.id, role, user.id);
      const url = `${window.location.origin}/?invite=${token}`;
      setLink(url);
      setCopied(false);
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      } catch {
        /* clipboard kan geweigerd worden; link staat zichtbaar om te kopiëren */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Link maken mislukt');
    }
  };

  const approve = async (profileId: string) => {
    setError(undefined);
    try {
      await approveMember(activeFamily.id, profileId);
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Goedkeuren mislukt');
    }
  };

  const remove = async (m: Member) => {
    if (!confirm(`${m.name} uit deze familie verwijderen? Zijn personen blijven bestaan.`)) return;
    setError(undefined);
    try {
      await removeMember(activeFamily.id, m.profileId);
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verwijderen mislukt');
    }
  };

  return (
    <div className="share-menu">
      <button className="auth-btn" onClick={() => setOpen((o) => !o)}>
        Delen
      </button>
      {open && (
        <div className="share-pop">
          <div className="family-group">{activeFamily.label} delen</div>
          {canInvite ? (
            <>
              {isOwner && (
                <label className="share-role">
                  Nodig uit als
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as 'viewer' | 'editor')}>
                    <option value="viewer">lezer (bekijkt alleen)</option>
                    <option value="editor">bewerker (voegt toe & beheert eigen toevoegingen)</option>
                  </select>
                </label>
              )}
              <button className="share-link-btn" onClick={makeLink}>
                {copied ? 'Link gekopieerd ✓' : 'Maak uitnodigingslink'}
              </button>
              {link && <input className="share-link" readOnly value={link} onFocus={(e) => e.target.select()} />}
            </>
          ) : (
            <div className="family-empty">je mag geen leden uitnodigen</div>
          )}

          <div className="family-group">Leden</div>
          {members.map((m) => (
            <div key={m.profileId} className="share-member">
              <span>
                {m.name}
                <span className="family-role">
                  {m.role}
                  {m.status === 'pending' ? ' · wacht' : ''}
                </span>
              </span>
              <span className="share-member-actions">
                {isOwner && m.status === 'pending' && (
                  <button className="share-approve" onClick={() => approve(m.profileId)}>
                    goedkeuren
                  </button>
                )}
                {isOwner && m.profileId !== user.id && (
                  <button
                    className="share-remove"
                    onClick={() => remove(m)}
                    title="Verwijder uit familie"
                    aria-label={`${m.name} verwijderen`}
                  >
                    ×
                  </button>
                )}
              </span>
            </div>
          ))}
          {error && <p className="family-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
