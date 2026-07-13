import { type GuideItem } from './guideContent';
import { BACKEND, useAppStore } from './store';
import { useGuide, useT } from './useT';

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
  const setTourOpen = useAppStore((s) => s.setTourOpen);
  const t = useT();
  const { title, intro, sections: allSections, localPrivacy } = useGuide().guide;

  // Lokale (offline) modus: multi-user-inhoud vervalt. Hele cloudOnly-secties
  // eruit; de privacy-sectie wordt vervangen door "alles blijft op je apparaat";
  // en binnen de overige secties vervallen cloudOnly-blokken/-items.
  const sections =
    BACKEND === 'local'
      ? allSections.flatMap((s) => {
          if (s.cloudOnly) return [];
          if (s.id === 'privacy') return [localPrivacy];
          return [{
            ...s,
            items: s.items?.filter((i) => !i.cloudOnly),
            blocks: s.blocks?.filter((b) => !b.cloudOnly).map((b) => ({
              ...b,
              items: b.items?.filter((i) => !i.cloudOnly),
            })),
          }];
        })
      : allSections;

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

            <button
              className="guide-tour-btn"
              onClick={() => {
                setOpen(false);
                setTourOpen(true);
              }}
            >
              ✨ {t.tour.start}
            </button>

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
