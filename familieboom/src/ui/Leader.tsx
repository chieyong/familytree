import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const SEEN_KEY = 'bloom-leader-seen';
const MIN_MS = 2400; // minimale toon-tijd: logo + woordmerk houden even stand
const MAX_MS = 4500; // harde bovengrens, mocht 'ready' nooit komen

interface Props {
  /** App klaar (graaf geladen) → leader mag weg zodra de minimumduur voorbij is. */
  ready: boolean;
}

/**
 * Opstart-leader (concept "logo bloeit open"): de takken tekenen zichzelf, de
 * knopen poppen na elkaar in, en het woordmerk stijgt op. Eén keer per sessie,
 * overslaanbaar, en uit bij prefers-reduced-motion. Overbrugt de koude start.
 */
export function Leader({ ready }: Props) {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(() => !reduce && !sessionStorage.getItem(SEEN_KEY));
  const [minDone, setMinDone] = useState(false);

  useEffect(() => {
    if (!show) return;
    sessionStorage.setItem(SEEN_KEY, '1');
    const min = setTimeout(() => setMinDone(true), MIN_MS);
    const max = setTimeout(() => setShow(false), MAX_MS);
    return () => {
      clearTimeout(min);
      clearTimeout(max);
    };
  }, [show]);

  useEffect(() => {
    if (minDone && ready) setShow(false);
  }, [minDone, ready]);

  const branch = { stroke: '#e0a458', strokeWidth: 3, fill: 'none', strokeLinecap: 'round' as const };
  const pop = (delay: number) => ({
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { delay, type: 'spring' as const, stiffness: 260, damping: 18 },
  });

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="leader"
          onClick={() => setShow(false)}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <svg width="132" height="132" viewBox="0 0 120 120" aria-hidden="true">
            {/* Takken tekenen zichzelf */}
            <motion.path
              d="M60 42.8 V56.25"
              {...branch}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.15, duration: 0.45, ease: 'easeInOut' }}
            />
            <motion.path
              d="M60 56.25 C 48.75 65.25, 40.5 71.25, 36.75 79.5"
              {...branch}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.45, duration: 0.5, ease: 'easeInOut' }}
            />
            <motion.path
              d="M60 56.25 C 71.25 65.25, 79.5 71.25, 83.25 79.5"
              {...branch}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.45, duration: 0.5, ease: 'easeInOut' }}
            />
            {/* Knopen bloeien na elkaar open */}
            <motion.circle cx="60" cy="31.5" r="12.4" fill="#e0a458" {...pop(0.2)} />
            <motion.circle cx="35.6" cy="88.5" r="12.4" fill="#5fb7a5" {...pop(0.85)} />
            <motion.circle cx="84.4" cy="88.5" r="12.4" fill="#8d7bd4" {...pop(1.0)} />
          </svg>
          {/* CSS-animatie i.p.v. framer-motion: rendert overal betrouwbaar. */}
          <div className="leader-word">Bloom</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
