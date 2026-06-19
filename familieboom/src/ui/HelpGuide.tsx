import { type GuideItem } from './guideContent';
import { useAppStore } from './store';
import { useGuide } from './useT';

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

/** Uitleg-gids (accordeon). De trigger zit in het ⋯-menu en de welkomstkaart;
 *  deze component rendert alleen het overlay zodra `guideOpen` aanstaat. */
export function HelpGuide() {
  const open = useAppStore((s) => s.guideOpen);
  const setOpen = useAppStore((s) => s.setGuideOpen);
  const { title, intro, sections } = useGuide().guide;

  return (
    <>
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
