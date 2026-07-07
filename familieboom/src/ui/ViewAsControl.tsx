import { useState } from 'react';
import type { ViewAsRole } from '../data/types';
import { useAppStore } from './store';
import { useT } from './useT';

interface Props {
  /** Alleen de owner van de actieve familie mag simuleren. */
  isOwner: boolean;
  /** Naam van de geselecteerde persoon, voor de "vanuit …"-optie. */
  focusName?: string;
}

function EyeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/**
 * Owner-tool "Bekijk als …": simuleer een lagere rol (en optioneel: vanuit de
 * geselecteerde persoon). Zet de simulatie in de store; App laadt de graaf dan
 * opnieuw via de server-side *_as-RPC's — de echte RLS, met gesimuleerde
 * identiteit. Rendert niets voor niet-owners.
 */
export function ViewAsControl({ isOwner, focusName }: Props) {
  const t = useT();
  const viewAs = useAppStore((s) => s.viewAs);
  const setViewAs = useAppStore((s) => s.setViewAs);
  const focusId = useAppStore((s) => s.focusId);
  const [open, setOpen] = useState(false);
  const [asPerson, setAsPerson] = useState(true);

  if (!isOwner) return null;

  const pick = (role: ViewAsRole) => {
    setViewAs({ role, personId: asPerson && focusName ? focusId : null });
    setOpen(false);
  };

  return (
    <div className="more-menu">
      <button
        className={`theme-toggle${viewAs ? ' active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={t.viewAs.title}
        title={t.viewAs.title}
      >
        <EyeIcon />
      </button>
      {open && (
        <>
          <div className="lang-backdrop" onClick={() => setOpen(false)} />
          <div className="more-pop">
            <span className="more-label">{t.viewAs.heading}</span>
            <button className="more-item" onClick={() => pick('viewer')}>{t.share.roleViewer}</button>
            <button className="more-item" onClick={() => pick('contributor')}>{t.share.roleContributor}</button>
            <button className="more-item" onClick={() => pick('editor')}>{t.share.roleEditor}</button>
            {focusName && (
              <label className="more-check">
                <input type="checkbox" checked={asPerson} onChange={(e) => setAsPerson(e.target.checked)} />
                {t.viewAs.asPerson(focusName)}
              </label>
            )}
            {viewAs && (
              <button className="more-item view-as-stop" onClick={() => { setViewAs(null); setOpen(false); }}>
                {t.viewAs.exit}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
