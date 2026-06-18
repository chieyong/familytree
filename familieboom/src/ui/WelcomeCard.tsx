import { useState } from 'react';
import { guideContent } from './guideContent';
import { useAppStore } from './store';

const WELCOME_KEY = 'familieboom-welcome-seen';

/** Eenmalige welkomstkaart bij de eerste login; daarna te vinden via de gids. */
export function WelcomeCard() {
  const user = useAppStore((s) => s.user);
  const setGuideOpen = useAppStore((s) => s.setGuideOpen);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(WELCOME_KEY) === '1');
  const { title, intro, leadIn, steps, start, more } = guideContent.welcome;

  if (!user || dismissed) return null;

  const close = () => {
    localStorage.setItem(WELCOME_KEY, '1');
    setDismissed(true);
  };
  const openGuide = () => {
    close();
    setGuideOpen(true);
  };

  return (
    <div className="auth-overlay" onClick={close}>
      <div className="welcome-card" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="welcome-intro">{intro}</p>
        <p className="welcome-intro">{leadIn}</p>
        <ol className="welcome-steps">
          {steps.map((step, i) => (
            <li className="welcome-step" key={step.title}>
              <span className="welcome-step-num">{i + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <span>{step.body}</span>
              </div>
            </li>
          ))}
        </ol>
        <div className="welcome-actions">
          <button onClick={close}>{start}</button>
          <button className="welcome-more" onClick={openGuide}>{more}</button>
        </div>
      </div>
    </div>
  );
}
