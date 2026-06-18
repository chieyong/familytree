import { LANGS, type Lang } from './i18n';
import { useAppStore } from './store';
import { useT } from './useT';

/** Compacte taalkeuze in de topbar. */
export function LangSwitcher() {
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const t = useT();
  return (
    <select
      className="lang-switcher"
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      aria-label={t.topbar.language}
      title={t.topbar.language}
    >
      {LANGS.map((l) => (
        <option key={l.id} value={l.id}>{l.label}</option>
      ))}
    </select>
  );
}
