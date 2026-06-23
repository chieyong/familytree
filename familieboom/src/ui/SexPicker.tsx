import { useT } from './useT';

type Sex = 'm' | 'f' | 'x' | '';

/**
 * Geslacht-keuze als tik-knoppen i.p.v. een native `<select>`. Op mobiel (vooral
 * iOS) opent een `<select>` binnen een `position: fixed`-paneel een native picker
 * die het paneel daarna onklikbaar kan maken; knoppen vermijden die picker
 * volledig. Nogmaals tikken op de actieve knop wist de keuze (= "niet ingevuld").
 */
export function SexPicker({ value, onChange }: { value: Sex; onChange: (s: Sex) => void }) {
  const t = useT();
  const options: { v: Exclude<Sex, ''>; label: string }[] = [
    { v: 'f', label: t.edit.sexF },
    { v: 'm', label: t.edit.sexM },
    { v: 'x', label: t.edit.sexX },
  ];
  return (
    <div className="seg-field">
      <span className="edit-field-label">{t.edit.sex}</span>
      <div className="seg-control" role="group" aria-label={t.edit.sex}>
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            className={`seg-btn${value === o.v ? ' active' : ''}`}
            aria-pressed={value === o.v}
            onClick={() => onChange(value === o.v ? '' : o.v)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
