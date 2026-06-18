import { useEffect, useState } from 'react';
import { approveMember, createInvite, listMembers, removeMember, updateMemberRole, type Member } from '../data/invites';
import { useAppStore } from './store';
import { useT } from './useT';

/** Owner/editor: deel de actieve familie (uitnodigingslink) en keur leden goed. */
export function ShareFamily() {
  const activeFamily = useAppStore((s) => s.activeFamily);
  const user = useAppStore((s) => s.user);
  const t = useT();
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
      setError(err instanceof Error ? err.message : t.share.loadFailed);
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
      setError(err instanceof Error ? err.message : t.share.linkFailed);
    }
  };

  const approve = async (profileId: string) => {
    setError(undefined);
    try {
      await approveMember(activeFamily.id, profileId);
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.share.approveFailed);
    }
  };

  const changeRole = async (profileId: string, role: 'viewer' | 'editor') => {
    setError(undefined);
    try {
      await updateMemberRole(activeFamily.id, profileId, role);
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.share.roleFailed);
    }
  };

  const remove = async (m: Member) => {
    if (!confirm(t.share.confirmRemove(m.name))) return;
    setError(undefined);
    try {
      await removeMember(activeFamily.id, m.profileId);
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.share.removeFailed);
    }
  };

  return (
    <div className="share-menu">
      <button className="auth-btn" onClick={() => setOpen((o) => !o)}>
        {t.share.share}
      </button>
      {open && (
        <div className="share-pop">
          <div className="family-group">{t.share.shareTitle(activeFamily.label)}</div>
          {canInvite ? (
            <>
              {isOwner && (
                <label className="share-role">
                  {t.share.inviteAs}
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as 'viewer' | 'editor')}>
                    <option value="viewer">{t.share.roleViewerLong}</option>
                    <option value="editor">{t.share.roleEditorLong}</option>
                  </select>
                </label>
              )}
              <button className="share-link-btn" onClick={makeLink}>
                {copied ? t.share.linkCopied : t.share.makeLink}
              </button>
              {link && <input className="share-link" readOnly value={link} onFocus={(e) => e.target.select()} />}
            </>
          ) : (
            <div className="family-empty">{t.share.cannotInvite}</div>
          )}

          <div className="family-group">{t.share.members}</div>
          {members.map((m) => (
            <div key={m.profileId} className="share-member">
              <span className="share-member-name">
                {m.name}
                {isOwner && m.profileId !== user.id && m.role !== 'owner' ? (
                  <select
                    className="share-role-select"
                    value={m.role}
                    onChange={(e) => changeRole(m.profileId, e.target.value as 'viewer' | 'editor')}
                  >
                    <option value="viewer">{t.share.roleViewer}</option>
                    <option value="editor">{t.share.roleEditor}</option>
                  </select>
                ) : (
                  <span className="family-role">{m.role}</span>
                )}
                {m.status === 'pending' && <span className="family-role">{t.share.pending}</span>}
              </span>
              <span className="share-member-actions">
                {isOwner && m.status === 'pending' && (
                  <button className="share-approve" onClick={() => approve(m.profileId)}>
                    {t.share.approve}
                  </button>
                )}
                {isOwner && m.profileId !== user.id && (
                  <button
                    className="share-remove"
                    onClick={() => remove(m)}
                    title={t.share.removeTitle}
                    aria-label={t.share.removeAria(m.name)}
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
