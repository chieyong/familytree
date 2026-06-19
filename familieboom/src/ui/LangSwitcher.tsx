import { useState } from 'react';
import { LANGS, type Lang } from './i18n';
import { useAppStore } from './store';
import { useT } from './useT';

/** Compacte taalkeuze: vlag-knop met een klein uitklapmenu. */
export function LangSwitcher() {
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const t = useT();
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.id === lang) ?? LANGS[0];

  return (
    <div className="lang-menu">
      <button
        className="theme-toggle lang-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={t.topbar.language}
        title={t.topbar.language}
      >
        <span className="lang-flag">{current.flag}</span>
      </button>
      {open && (
        <>
          <div className="lang-backdrop" onClick={() => setOpen(false)} />
          <div className="lang-pop">
            {LANGS.map((l) => (
              <button
                key={l.id}
                className={`lang-item${l.id === lang ? ' active' : ''}`}
                onClick={() => {
                  setLang(l.id as Lang);
                  setOpen(false);
                }}
              >
                <span className="lang-flag">{l.flag}</span>
                {l.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
