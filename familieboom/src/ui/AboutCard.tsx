import { BACKEND, useAppStore } from './store';
import { useT } from './useT';

const PORTFOLIO_URL = 'https://vizcraft.nl';
const WEEKLYPULSE_URL = 'https://weeklypulse.vizcraft.nl/';
const LINKEDIN_URL = 'https://www.linkedin.com/in/chieyong/';
/** GitHub Releases (nieuwste) — hier staan de macOS- en Windows-installers. */
const RELEASES_URL = 'https://github.com/chieyong/familytree/releases/latest';

/** "Over de maker"-paneel: korte achtergrond + links naar portfolio/LinkedIn. */
export function AboutCard() {
  const open = useAppStore((s) => s.aboutOpen);
  const setAboutOpen = useAppStore((s) => s.setAboutOpen);
  const about = useT().about;
  const { title, body, portfolio, weeklypulse, linkedin, close } = about;

  if (!open) return null;

  return (
    <div className="auth-overlay" onClick={() => setAboutOpen(false)}>
      <div className="welcome-card about-card" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {body.map((paragraph, i) => (
          <p className="welcome-intro" key={i}>
            {paragraph}
          </p>
        ))}
        <div className="about-links">
          <a className="about-link primary" href={PORTFOLIO_URL} target="_blank" rel="noopener noreferrer">
            {portfolio} →
          </a>
          <a className="about-link" href={WEEKLYPULSE_URL} target="_blank" rel="noopener noreferrer">
            {weeklypulse}
          </a>
          <a className="about-link" href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer">
            {linkedin}
          </a>
        </div>

        {/* Download de offline desktop-app. Niet tonen in de desktop-app zelf. */}
        {BACKEND !== 'local' && (
          <div className="about-download">
            <h4>{about.downloadTitle}</h4>
            <div className="about-download-buttons">
              <a className="about-link primary" href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
                {about.downloadMac}
              </a>
              <a className="about-link primary" href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
                {about.downloadWin}
              </a>
            </div>
            <p className="about-download-note">{about.downloadNote}</p>
          </div>
        )}

        <div className="welcome-actions">
          <button onClick={() => setAboutOpen(false)}>{close}</button>
        </div>
      </div>
    </div>
  );
}
