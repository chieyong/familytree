import { LANGS, type Lang } from './i18n';
import { useAppStore } from './store';
import { useT } from './useT';

interface Props {
  /** Toont de foto-schakelaar alleen als er foto's in de boom zijn. */
  photosAvailable: boolean;
  /** Start het printpad (App regelt oriëntatie + Boom-centrering); ontbreekt
   *  in de Atlas, waar afdrukken niet aangeboden wordt. */
  onPrint?: () => void;
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

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.9" y1="4.9" x2="7" y2="7" /><line x1="17" y1="17" x2="19.1" y2="19.1" />
      <line x1="4.9" y1="19.1" x2="7" y2="17" /><line x1="17" y1="7" x2="19.1" y2="4.9" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

/**
 * Verzamelt de secundaire bediening (taal, thema, foto's, uitleg) onder één
 * knop, zodat de topbar — vooral op mobiel — overzichtelijk blijft. De
 * open-state staat in de store (topbarPop): zo staat er maar één topbar-menu
 * tegelijk open en wijkt de zwevende bereik-/laagtoggle zolang dit menu toont.
 */
export function OverflowMenu({ photosAvailable, onPrint }: Props) {
  const t = useT();
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const photos = useAppStore((s) => s.photos);
  const togglePhotos = useAppStore((s) => s.togglePhotos);
  const setGuideOpen = useAppStore((s) => s.setGuideOpen);
  const setAboutOpen = useAppStore((s) => s.setAboutOpen);
  const topbarPop = useAppStore((s) => s.topbarPop);
  const setTopbarPop = useAppStore((s) => s.setTopbarPop);
  const open = topbarPop === 'more';

  return (
    <div className="more-menu">
      <button
        className="theme-toggle"
        onClick={() => setTopbarPop(open ? null : 'more')}
        aria-label={t.topbar.more}
        title={t.topbar.more}
      >
        <MoreIcon />
      </button>
      {open && (
        <>
          <div className="lang-backdrop" onClick={() => setTopbarPop(null)} />
          <div className="more-pop">
            <div className="more-section">
              <div className="more-row">
                <span className="more-label">{t.topbar.language}</span>
                <select
                  className="more-select"
                  value={lang}
                  onChange={(e) => setLang(e.target.value as Lang)}
                  aria-label={t.topbar.language}
                >
                  {LANGS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.flag} {l.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="more-row">
                <span className="more-label">{t.topbar.theme}</span>
                <div className="theme-seg" role="group" aria-label={t.topbar.theme}>
                  <button
                    className={`theme-seg-btn${theme === 'light' ? ' active' : ''}`}
                    aria-label={t.topbar.lightMode}
                    title={t.topbar.lightMode}
                    onClick={() => theme !== 'light' && toggleTheme()}
                  >
                    <SunIcon />
                  </button>
                  <button
                    className={`theme-seg-btn${theme === 'dark' ? ' active' : ''}`}
                    aria-label={t.topbar.darkMode}
                    title={t.topbar.darkMode}
                    onClick={() => theme !== 'dark' && toggleTheme()}
                  >
                    <MoonIcon />
                  </button>
                </div>
              </div>
            </div>

            {photosAvailable && (
              <button className="more-item" onClick={togglePhotos}>
                {photos ? t.topbar.hidePhotos : t.topbar.showPhotos}
              </button>
            )}

            {onPrint && (
              <button
                className="more-item"
                onClick={() => {
                  setTopbarPop(null);
                  onPrint();
                }}
              >
                {t.topbar.print}
              </button>
            )}

            <button
              className="more-item"
              onClick={() => {
                setGuideOpen(true);
                setTopbarPop(null);
              }}
            >
              {t.topbar.help}
            </button>

            <button
              className="more-item"
              onClick={() => {
                setAboutOpen(true);
                setTopbarPop(null);
              }}
            >
              {t.topbar.about}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
