import { useState } from 'react';
import { LANGS, type Lang } from './i18n';
import { useAppStore } from './store';
import { useT } from './useT';

interface Props {
  /** Toont de foto-schakelaar alleen als er foto's in de boom zijn. */
  photosAvailable: boolean;
}

function MoreIcon() {
  // Schuifregelaars: leest als "instellingen / aanpassen".
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <line x1="21" y1="6" x2="14" y2="6" /><line x1="10" y1="6" x2="3" y2="6" />
      <line x1="21" y1="12" x2="12" y2="12" /><line x1="8" y1="12" x2="3" y2="12" />
      <line x1="21" y1="18" x2="16" y2="18" /><line x1="12" y1="18" x2="3" y2="18" />
      <line x1="12" y1="4" x2="12" y2="8" />
      <line x1="6" y1="10" x2="6" y2="14" />
      <line x1="14" y1="16" x2="14" y2="20" />
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
