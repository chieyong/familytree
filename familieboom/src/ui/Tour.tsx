import { useEffect, useLayoutEffect, useState } from 'react';
import { useAppStore } from './store';
import { useT } from './useT';

/** Stap = een echt element (CSS-selector) + de uitleg-sleutel. */
const STEPS: { sel: string; key: 'views' | 'more' | 'card' | 'family' }[] = [
  { sel: '.mode-toggle', key: 'views' },
  { sel: '.more-menu', key: 'more' },
  { sel: '.person-card', key: 'card' },
  { sel: '.family-menu', key: 'family' },
];

const PAD = 6;

/**
 * Coachmark-rondleiding: dimt het scherm en zet een spotlight op echte
 * elementen, met een korte tooltip per stap. Wijst aan wáár dingen zitten en
 * blijft kloppen ondanks UI-wijzigingen (het target de live DOM).
 */
export function Tour() {
  const open = useAppStore((s) => s.tourOpen);
  const setOpen = useAppStore((s) => s.setTourOpen);
  const t = useT();

  // Alleen de stappen waarvan het element nu bestaat (bv. geen kaart → overslaan).
  const [steps, setSteps] = useState<typeof STEPS>([]);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect>();

  useEffect(() => {
    if (!open) return;
    setSteps(STEPS.filter((s) => document.querySelector(s.sel)));
    setI(0);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || steps.length === 0) return;
    const measure = () => {
      const el = document.querySelector(steps[i]?.sel);
      if (el) setRect(el.getBoundingClientRect());
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, steps, i]);

  if (!open || steps.length === 0 || !rect) return null;

  const last = i === steps.length - 1;
  const stop = () => setOpen(false);
  const below = rect.top < window.innerHeight / 2;

  const spotStyle = {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };
  const tipStyle = below
    ? { top: rect.bottom + 14 }
    : { bottom: window.innerHeight - rect.top + 14 };

  return (
    <div className="tour">
      <div className="tour-backdrop" onClick={stop} />
      <div className="tour-spot" style={spotStyle} />
      <div className="tour-tip" style={tipStyle}>
        <p>{t.tour[steps[i].key]}</p>
        <div className="tour-nav">
          <span className="tour-count">{i + 1}/{steps.length}</span>
          <button className="tour-skip" onClick={stop}>{t.tour.skip}</button>
          {i > 0 && <button className="tour-btn" onClick={() => setI(i - 1)}>{t.tour.prev}</button>}
          <button className="tour-btn tour-next" onClick={() => (last ? stop() : setI(i + 1))}>
            {last ? t.tour.done : t.tour.next}
          </button>
        </div>
      </div>
    </div>
  );
}
