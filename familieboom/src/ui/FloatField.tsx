import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  /** Zwevend label: staat als placeholder in het lege veld, schuift omhoog bij invullen. */
  label: string;
  /** Extra class op de wrapper (bv. voor breedte in een rij). */
  wrapClass?: string;
}

/**
 * Invoerveld met floating label. De placeholder is bewust één spatie, zodat de
 * CSS-selector `:placeholder-shown` weet of het veld leeg is en het label kan
 * laten zweven. Zo blijft het doel van het veld zichtbaar als het is ingevuld.
 */
export function FloatField({ label, wrapClass, ...rest }: Props) {
  return (
    <label className={`float-field${wrapClass ? ` ${wrapClass}` : ''}`}>
      <input {...rest} placeholder=" " />
      <span className="float-label">{label}</span>
    </label>
  );
}
