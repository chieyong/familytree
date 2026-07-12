import { useEffect, useRef, useState } from 'react';
import type { Person, Visibility } from '../data/types';
import { addResidence, deletePerson, removePersonPhoto, removeResidence, setPersonPlace, signedAvatarUrls, updatePerson, updateResidence, uploadPersonPhoto, type PersonEdit, type PlaceInput } from '../data/mutations';
import type { Residence } from '../data/types';
import { FloatField } from './FloatField';
import { PlaceField } from './PlaceField';
import { PhotoEditor } from './PhotoEditor';
import { SexPicker } from './SexPicker';
import { BACKEND, useAppStore } from './store';
import { useT } from './useT';

interface Props {
  person: Person;
  /** De ego van de actieve familie; die mag je niet verwijderen (breekt "ik"). */
  egoId: string;
  /** In een paneel: meteen open, geen toggle/annuleer. */
  embedded?: boolean;
  /** Voorstel-modus (rol Bijdrager): niet direct opslaan, maar indienen. */
  proposalMode?: boolean;
  /** Aangeroepen met de wijziging als de bijdrager 'Voorstel indienen' kiest. */
  onSubmitProposal?: (e: PersonEdit) => Promise<void>;
}

/** CRUD: bewerk of verwijder de focuspersoon (eigen boom). */
export function EditPerson({ person, egoId, embedded, proposalMode, onSubmitProposal }: Props) {
  const bumpData = useAppStore((s) => s.bumpData);
  const setFocus = useAppStore((s) => s.setFocus);
  const activeFamily = useAppStore((s) => s.activeFamily);
  const t = useT();

  const [open, setOpen] = useState(embedded ?? false);
  const [given, setGiven] = useState(person.givenNames.join(' '));
  // Roepnaam = label in de boom. Leeg laten betekent: val terug op de volledige
  // voornaam (juist voor een meerdelige naam als "Buk Sing"). Bij een bestaande
  // persoon staat hier de opgeslagen roepnaam (of leeg) — geen auto-spiegeling,
  // zodat het bewerken van voornamen 'm niet ongewenst overschrijft.
  const [callName, setCallName] = useState(person.callName ?? '');
  const [familyName, setFamilyName] = useState(person.familyName ?? '');
  const [nameNative, setNameNative] = useState(person.nameNative ?? '');
  const [nicknames, setNicknames] = useState<string[]>(person.nicknames ?? []);
  // "Toon in boom" is vervangen door de roepnaam; bewaar een eventuele oude waarde.
  const preferredName = person.preferredName;
  const [sex, setSex] = useState<'m' | 'f' | 'x' | ''>(person.sex ?? '');
  const [birthYear, setBirthYear] = useState(String(person.birth?.date?.year ?? ''));
  const [deathYear, setDeathYear] = useState(String(person.death?.date?.year ?? ''));
  const [visibility, setVisibility] = useState<Visibility>(person.visibility);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // Woonplaats-toevoegrij (geocoder + vanaf-jaar). resKey remount het plaatsveld
  // na een toevoeging, zodat het weer leeg is voor de volgende woonplaats.
  const [newResYear, setNewResYear] = useState('');
  const [resKey, setResKey] = useState(0);

  // Profielfoto: huidige (ondertekende) preview + upload/verwijder.
  const [photoUrl, setPhotoUrl] = useState<string>();
  const [photoBusy, setPhotoBusy] = useState(false);
  // Foto-editor: bron is een gekozen bestand of de live camera.
  const [editor, setEditor] = useState<{ file?: File; camera?: boolean }>();
  useEffect(() => {
    let active = true;
    if (person.photoPath) {
      signedAvatarUrls([person.photoPath]).then((m) => {
        if (active) setPhotoUrl(m.get(person.photoPath!));
      });
    } else {
      setPhotoUrl(undefined);
    }
    return () => { active = false; };
  }, [person.photoPath]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // zelfde bestand opnieuw kunnen kiezen
    if (file) setEditor({ file });
  };

  // Bijgesneden vierkante foto uit de editor → uploaden.
  const onCropped = async (file: File) => {
    setEditor(undefined);
    if (!activeFamily) return;
    setPhotoBusy(true);
    setError(undefined);
    try {
      await uploadPersonPhoto(activeFamily.id, person.id, file);
      setPhotoUrl(URL.createObjectURL(file)); // directe preview
      bumpData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.edit.photoUploadFailed);
    } finally {
      setPhotoBusy(false);
    }
  };

  const onRemovePhoto = async () => {
    if (!activeFamily) return;
    setPhotoBusy(true);
    setError(undefined);
    try {
      await removePersonPhoto(activeFamily.id, person.id);
      setPhotoUrl(undefined);
      bumpData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.edit.photoRemoveFailed);
    } finally {
      setPhotoBusy(false);
    }
  };

  // Geboorte-/sterfteplaats: los van de naamvelden (eigen geocoder-veld). De plaats
  // wordt direct opgeslagen bij kiezen/wissen → de persoon verschijnt op de Atlas.
  const placeValue = (place?: Person['birth']): PlaceInput | undefined => {
    const pl = place?.place;
    return pl && pl.lat != null && pl.lon != null
      ? { name: pl.name, lat: pl.lat, lon: pl.lon, wikidataId: pl.wikidataId }
      : undefined;
  };

  // Automatisch opslaan: elke veldwijziging schrijft (debounced) weg; geen
  // opslaan-knop meer. "Voornamen" is verplicht — bij een leeg veld slaan we niet
  // op (anders zou je per ongeluk de naam wissen).
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const firstRender = useRef(true);

  // De huidige velden als PersonEdit (gedeeld door auto-opslaan en voorstel-indienen).
  const buildEdit = (): PersonEdit => ({
    given: given.trim(),
    callName: callName.trim() || undefined,
    familyName: familyName.trim() || undefined,
    nameNative: nameNative.trim() || undefined,
    nicknames: nicknames.map((n) => n.trim()).filter(Boolean),
    preferredName,
    sex: sex || undefined,
    birthYear: birthYear ? Number(birthYear) : undefined,
    deathYear: deathYear ? Number(deathYear) : undefined,
    visibility,
  });

  useEffect(() => {
    if (proposalMode) return; // bijdrager dient in via een knop, geen auto-opslaan
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!given.trim()) return;
    const handle = setTimeout(async () => {
      setSaveState('saving');
      setError(undefined);
      try {
        await updatePerson(person.id, buildEdit());
        bumpData();
        setSaveState('saved');
      } catch (err) {
        setError(err instanceof Error ? err.message : t.edit.saveFailed);
        setSaveState('idle');
      }
    }, 700);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [given, callName, familyName, nameNative, nicknames, preferredName, sex, birthYear, deathYear, visibility]);

  const submitProposal = async () => {
    if (!given.trim() || !onSubmitProposal) return;
    setBusy(true);
    setError(undefined);
    try {
      await onSubmitProposal(buildEdit());
    } catch (err) {
      setError(err instanceof Error ? err.message : t.proposal.submitFailed);
    } finally {
      setBusy(false);
    }
  };

  const onPlace = async (kind: 'birth' | 'death', place: PlaceInput | null) => {
    setSaveState('saving');
    setError(undefined);
    try {
      await setPersonPlace(person.id, kind, place);
      bumpData();
      setSaveState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.edit.saveFailed);
      setSaveState('idle');
    }
  };

  // Woonplaats wordt direct opgeslagen zodra je een plaats kiest (auto-opslaan,
  // net als de geboorte-/sterfteplaats). Het optionele 'vanaf'-jaar dat op dat
  // moment in het veld staat gaat mee; daarna wordt de rij weer leeggemaakt.
  const onAddResidence = async (place: PlaceInput | null) => {
    if (!place) return;
    setSaveState('saving');
    setError(undefined);
    try {
      await addResidence(person.id, place, newResYear ? Number(newResYear) : undefined);
      setNewResYear('');
      setResKey((k) => k + 1);
      bumpData();
      setSaveState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.edit.saveFailed);
      setSaveState('idle');
    }
  };

  const onRemoveResidence = async (id: string) => {
    setSaveState('saving');
    setError(undefined);
    try {
      await removeResidence(id);
      bumpData();
      setSaveState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.edit.saveFailed);
      setSaveState('idle');
    }
  };

  const onResidenceYear = async (id: string, fromYear?: number) => {
    setSaveState('saving');
    setError(undefined);
    try {
      await updateResidence(id, fromYear);
      bumpData();
      setSaveState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.edit.saveFailed);
      setSaveState('idle');
    }
  };

  // "Opgeslagen ✓" weer laten vervagen.
  useEffect(() => {
    if (saveState !== 'saved') return;
    const handle = setTimeout(() => setSaveState('idle'), 1600);
    return () => clearTimeout(handle);
  }, [saveState]);

  const remove = async () => {
    if (!confirm(t.edit.confirmDelete(person.givenNames[0] ?? '?'))) return;
    setBusy(true);
    setError(undefined);
    try {
      await deletePerson(person.id);
      bumpData();
      if (!embedded) setOpen(false);
      if (activeFamily) setFocus(activeFamily.ego); // terug naar jezelf
    } catch (err) {
      setError(err instanceof Error ? err.message : t.edit.deleteFailed);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button className="add-rel-btn edit-toggle" onClick={() => setOpen(true)}>
        ✎ {t.edit.edit}
      </button>
    );
  }

  return (
    <form className="add-relative-form" onSubmit={(e) => e.preventDefault()}>
      {/* Foto's gaan (nog) niet via voorstellen — alleen bij direct bewerken. */}
      {/* Foto's nog niet in de lokale (offline) modus. */}
      {!proposalMode && BACKEND !== 'local' && (
        <>
          <div className="edit-photo">
            {photoUrl ? (
              <img className="edit-photo-preview" src={photoUrl} alt="" />
            ) : (
              <div className="edit-photo-empty" aria-hidden="true">+</div>
            )}
            <div className="edit-photo-actions">
              <label className="link-btn file-label">
                {photoBusy ? t.edit.busy : photoUrl ? t.edit.photoReplace : t.edit.photoChoose}
                <input type="file" accept="image/*" onChange={onPickFile} disabled={photoBusy} hidden />
              </label>
              <button type="button" className="link-btn" onClick={() => setEditor({ camera: true })} disabled={photoBusy}>
                {t.edit.camera}
              </button>
              {photoUrl && (
                <button type="button" className="link-btn link-danger" onClick={onRemovePhoto} disabled={photoBusy}>
                  {t.edit.removePhoto}
                </button>
              )}
            </div>
          </div>
          {editor && (
            <PhotoEditor
              initialFile={editor.file}
              startCamera={editor.camera}
              onCancel={() => setEditor(undefined)}
              onSave={onCropped}
            />
          )}
        </>
      )}
      <FloatField label={t.edit.firstName} value={given} required
        onChange={(e) => setGiven(e.target.value)} />
      <FloatField label={t.edit.callName} value={callName}
        onChange={(e) => setCallName(e.target.value)} />
      <FloatField label={t.edit.lastName} value={familyName}
        onChange={(e) => setFamilyName(e.target.value)} />
      <FloatField label={t.edit.nativeName} value={nameNative}
        onChange={(e) => setNameNative(e.target.value)} />
      {/* Bijnamen: één of meer, de eerste is de primaire (boom-label). */}
      <div className="nicknames-field">
        <span className="edit-field-label">{t.edit.nicknamesLabel}</span>
        {nicknames.map((n, i) => (
          <div className="nickname-row" key={i}>
            <FloatField label={t.edit.nickname} value={n}
              onChange={(e) => setNicknames((nn) => nn.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" className="link-btn link-danger" aria-label={t.edit.nicknameRemove}
              onClick={() => setNicknames((nn) => nn.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        <button type="button" className="link-btn nickname-add-btn"
          onClick={() => setNicknames((nn) => [...nn, ''])}>
          {t.edit.nicknameAdd}
        </button>
      </div>
      <SexPicker value={sex} onChange={setSex} />
      <div className="add-rel-row">
        <FloatField label={t.edit.birthAbbr} inputMode="numeric"
          value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ''))} />
        <FloatField label={t.edit.deathAbbr} inputMode="numeric"
          value={deathYear} onChange={(e) => setDeathYear(e.target.value.replace(/\D/g, ''))} />
      </div>
      {/* Geboorteplaats, dan woonplaatsen (levensreis), dan sterfteplaats —
          chronologisch. Geocoder-velden slaan direct op; voeden de Atlas. */}
      {!proposalMode && (
        <>
          <PlaceField label={t.edit.birthPlace} value={placeValue(person.birth)}
            onChange={(p) => onPlace('birth', p)} />

          {/* Woonplaatsen: levensreis-tussenstops op de Atlas. */}
          <div className="residences-field">
            <span className="edit-field-label">{t.edit.residencesLabel}</span>
            {(person.residences ?? []).map((r, i) => (
              <ResidenceRow
                key={r.id ?? `${r.place.name}-${i}`}
                residence={r}
                fromYearLabel={t.edit.fromYear}
                removeLabel={t.edit.residenceRemove}
                onYear={(year) => r.id && onResidenceYear(r.id, year)}
                onRemove={() => r.id && onRemoveResidence(r.id)}
              />
            ))}
            <div className="add-rel-row residence-add">
              <PlaceField key={resKey} label={t.edit.addResidence}
                onChange={onAddResidence} />
              <FloatField label={t.edit.fromYear} inputMode="numeric" wrapClass="residence-year"
                value={newResYear} onChange={(e) => setNewResYear(e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>

          <PlaceField label={t.edit.deathPlace} value={placeValue(person.death)}
            onChange={(p) => onPlace('death', p)} />
        </>
      )}
      {/* Zichtbaarheid als knoppen. 'openbaar' niet meer aanbiedbaar (geen publieke
          weergave); alleen tonen als deze persoon er al op staat → terug te zetten. */}
      <div className="seg-field">
        <span className="edit-field-label">{t.edit.visibilityLabel}</span>
        <div className="seg-control" role="group" aria-label={t.edit.visibilityLabel}>
          <button type="button" className={`seg-btn${visibility === 'family' ? ' active' : ''}`}
            aria-pressed={visibility === 'family'} onClick={() => setVisibility('family')}>
            {t.edit.visFamilyShort}
          </button>
          <button type="button" className={`seg-btn${visibility === 'private' ? ' active' : ''}`}
            aria-pressed={visibility === 'private'} onClick={() => setVisibility('private')}>
            {t.edit.visPrivateShort}
          </button>
          {visibility === 'public' && (
            <button type="button" className="seg-btn active" aria-pressed>
              {t.edit.visPublicShort}
            </button>
          )}
        </div>
        <p className="field-hint">{t.edit.visibilityHint}</p>
      </div>
      {error && <p className="add-rel-error">{error}</p>}
      {proposalMode ? (
        <div className="welcome-actions">
          <button type="button" onClick={submitProposal} disabled={busy || !given.trim()}>
            {busy ? '…' : t.proposal.submit}
          </button>
        </div>
      ) : (
        <div className="autosave-row">
          <span className="autosave-status" aria-live="polite">
            {saveState === 'saving' ? t.edit.saving : saveState === 'saved' ? t.edit.saved : ''}
          </span>
          {person.id !== egoId && (
            <button type="button" className="delete-btn" onClick={remove} disabled={busy}>
              {t.edit.delete}
            </button>
          )}
        </div>
      )}
    </form>
  );
}

/** Eén woonplaats-rij: plaatsnaam + bewerkbaar vanaf-jaar (opslaan bij verlaten). */
function ResidenceRow({
  residence, fromYearLabel, removeLabel, onYear, onRemove,
}: {
  residence: Residence;
  fromYearLabel: string;
  removeLabel: string;
  onYear: (year?: number) => void;
  onRemove: () => void;
}) {
  const [year, setYear] = useState(residence.from?.year != null ? String(residence.from.year) : '');
  // Externe wijziging (herladen na opslaan) spiegelen.
  useEffect(() => {
    setYear(residence.from?.year != null ? String(residence.from.year) : '');
  }, [residence.from?.year]);

  const commit = () => {
    const next = year ? Number(year) : undefined;
    if (next !== residence.from?.year) onYear(next);
  };

  return (
    <div className="residence-row">
      <span className="residence-name">{residence.place.name}</span>
      <FloatField label={fromYearLabel} inputMode="numeric" wrapClass="residence-year"
        value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} onBlur={commit} />
      <button type="button" className="link-btn link-danger" aria-label={removeLabel} onClick={onRemove}>
        ×
      </button>
    </div>
  );
}
