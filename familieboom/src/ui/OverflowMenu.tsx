import { useState } from 'react';
import { LANGS, type Lang } from './i18n';
import { useAppStore } from './store';
import { useT } from './useT';

interface Props {
  /** Toont de foto-schakelaar alleen als er foto's in de boom zijn. */
  photosAvailable: boolean;
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

/**
 * Verzamelt de secundaire bediening (taal, thema, foto's, uitleg) onder één
 * knop, zodat de topbar — vooral op mobiel — overzichtelijk blijft.
 */
export function OverflowMenu({ photosAvailable }: Props) {
  const t = useT();
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const photos = useAppStore((s) => s.photos);
  const togglePhotos = useAppStore((s) => s.togglePhotos);
  const setGuideOpen = useAppStore((s) => s.setGuideOpen);
  const [open, setOpen] = useState(false);

  return (
    <div className="more-menu">
      <button
        className="theme-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-label={t.topbar.more}
        title={t.topbar.more}
      >
        <MoreIcon />
      </button>
      {open && (
        <>
          <div className="lang-backdrop" onClick={() => setOpen(false)} />
          <div className="more-pop">
            <div className="more-section">
              <span className="more-label">{t.topbar.language}</span>
              <div className="more-flags">
                {LANGS.map((l) => (
                  <button
                    key={l.id}
                    className={`more-flag${l.id === lang ? ' active' : ''}`}
                    onClick={() => setLang(l.id as Lang)}
                    title={l.label}
                    aria-label={l.label}
                  >
                    {l.flag}
                  </button>
                ))}
              </div>
            </div>

            <button className="more-item" onClick={toggleTheme}>
              {theme === 'dark' ? t.topbar.lightMode : t.topbar.darkMode}
            </button>

            {photosAvailable && (
              <button className="more-item" onClick={togglePhotos}>
                {photos ? t.topbar.hidePhotos : t.topbar.showPhotos}
              </button>
            )}

            <button
              className="more-item"
              onClick={() => {
                setGuideOpen(true);
                setOpen(false);
              }}
            >
              {t.topbar.help}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
