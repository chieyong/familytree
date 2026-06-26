import { useEffect, useRef, useState } from 'react';
import { geocode, type GeoHit } from '../data/geocode';
import type { PlaceInput } from '../data/mutations';
import { useAppStore } from './store';
import { useT } from './useT';

interface Props {
  label: string;
  /** Huidige plaats (met coördinaten) of leeg. */
  value?: PlaceInput;
  onChange: (place: PlaceInput | null) => void;
  disabled?: boolean;
}

/**
 * Plaatsveld met type-ahead: typ een plaatsnaam, kies uit de geocoder-resultaten
 * (Nominatim). De gekozen plaats levert naam + lat/lon; wissen met ×. Past in de
 * floating-label-stijl van het bewerkformulier.
 */
export function PlaceField({ label, value, onChange, disabled }: Props) {
  const lang = useAppStore((s) => s.lang);
  const t = useT();
  const [text, setText] = useState(value?.name ?? '');
  const [hits, setHits] = useState<GeoHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // 'dirty' = de gebruiker tikt en heeft nog niet gekozen → dan pas zoeken/openen.
  const [dirty, setDirty] = useState(false);
  const blurTimer = useRef<number>(0);

  // Externe waarde gewijzigd (andere persoon, opslaan) → tekst spiegelen.
  useEffect(() => {
    setText(value?.name ?? '');
    setDirty(false);
    setHits([]);
  }, [value?.name, value?.lat, value?.lon]);

  // Debounced geocode terwijl de gebruiker typt.
  useEffect(() => {
    if (!dirty) return;
    const q = text.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const handle = window.setTimeout(() => {
      geocode(q, lang, ctrl.signal)
        .then((r) => {
          setHits(r);
          setOpen(true);
        })
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 450);
    return () => {
      clearTimeout(handle);
      ctrl.abort();
    };
  }, [text, dirty, lang]);

  const pick = (h: GeoHit) => {
    onChange({ name: h.name, lat: h.lat, lon: h.lon });
    setText(h.name);
    setHits([]);
    setOpen(false);
    setDirty(false);
  };

  const clear = () => {
    onChange(null);
    setText('');
    setHits([]);
    setOpen(false);
    setDirty(false);
  };

  return (
    <div className="place-field">
      <label className="float-field place-input">
        <input
          placeholder=" "
          value={text}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => {
            setText(e.target.value);
            setDirty(true);
          }}
          onFocus={() => hits.length > 0 && setOpen(true)}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setOpen(false), 160);
          }}
        />
        <span className="float-label">{label}</span>
        {value && !dirty && (
          <button type="button" className="place-clear" onClick={clear} aria-label={t.edit.placeClear}>
            ×
          </button>
        )}
      </label>

      {open && dirty && (
        <ul className="place-results" onMouseDown={() => clearTimeout(blurTimer.current)}>
          {loading && <li className="place-status">{t.edit.placeSearching}</li>}
          {!loading && hits.length === 0 && text.trim().length >= 2 && (
            <li className="place-status">{t.edit.placeNoResults}</li>
          )}
          {hits.map((h, i) => (
            <li key={`${h.lat},${h.lon},${i}`}>
              <button type="button" onClick={() => pick(h)}>
                <strong>{h.name}</strong>
                <span>{h.display}</span>
              </button>
            </li>
          ))}
          {hits.length > 0 && <li className="place-attribution">{t.edit.placeAttribution}</li>}
        </ul>
      )}
    </div>
  );
}
