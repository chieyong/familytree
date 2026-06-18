import { guideContent, type GuideItem } from './guideContent';
import { useAppStore } from './store';

function ItemList({ items }: { items?: GuideItem[] }) {
  if (!items?.length) return null;
  return (
    <ul>
      {items.map((it, i) => (
        <li key={i}>
          {it.label && <strong>{it.label}</strong>}
          {it.label ? ` — ${it.text}` : it.text}
        </li>
      ))}
    </ul>
  );
}

function GuideIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5a2 2 0 0 1 2-2h6v17H6a2 2 0 0 0-2 2z" />
      <path d="M20 5a2 2 0 0 0-2-2h-6v17h6a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/** "?"-achtige knop in de topbar die de uitleg-gids opent (accordeon). */
export function HelpGuide() {
  const open = useAppStore((s) => s.guideOpen);
  const setOpen = useAppStore((s) => s.setGuideOpen);
  const { title, intro, sections } = guideContent.guide;

  return (
    <>
      <button
        className="info-toggle"
        onClick={() => setOpen(true)}
        aria-label="Hoe werkt Bloom?"
        title="Hoe werkt Bloom?"
      >
        <GuideIcon />
      </button>
      {open && (
        <div className="auth-overlay" onClick={() => setOpen(false)}>
          <div className="info-card" onClick={(e) => e.stopPropagation()}>
            <div className="info-head">
              <h2>{title}</h2>
              <button className="panel-close" onClick={() => setOpen(false)} aria-label="Sluiten">
                ×
              </button>
            </div>

            <p className="info-intro">{intro}</p>

            {sections.map((s) => (
              <details className="guide-section" key={s.q}>
                <summary>{s.q}</summary>
                {s.p?.map((para, i) => <p key={i}>{para}</p>)}
                <ItemList items={s.items} />
                {s.note && <p className="info-ex">{s.note}</p>}
                {s.blocks?.map((b, i) => (
                  <div className="guide-block" key={i}>
                    {b.h && <h4>{b.h}</h4>}
                    {b.p?.map((para, j) => <p key={j}>{para}</p>)}
                    <ItemList items={b.items} />
                    {b.note && <p className="info-ex">{b.note}</p>}
                  </div>
                ))}
              </details>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
