import { useAppStore } from './store';
import { useT } from './useT';

const PORTFOLIO_URL = 'https://vizcraft.nl';
const WEEKLYPULSE_URL = 'https://weeklypulse.vizcraft.nl/';
const LINKEDIN_URL = 'https://www.linkedin.com/in/chieyong/';

/** "Over de maker"-paneel: korte achtergrond + links naar portfolio/LinkedIn. */
export function AboutCard() {
  const open = useAppStore((s) => s.aboutOpen);
  const setAboutOpen = useAppStore((s) => s.setAboutOpen);
  const { title, body, portfolio, weeklypulse, linkedin, close } = useT().about;

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
        <div className="welcome-actions">
          <button onClick={() => setAboutOpen(false)}>{close}</button>
        </div>
      </div>
    </div>
  );
}
