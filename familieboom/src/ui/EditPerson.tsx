import { useEffect, useRef, useState } from 'react';
import type { Person, Visibility } from '../data/types';
import { deletePerson, removePersonPhoto, signedAvatarUrls, updatePerson, uploadPersonPhoto } from '../data/mutations';
import { FloatField } from './FloatField';
import { PhotoEditor } from './PhotoEditor';
import { SexPicker } from './SexPicker';
import { useAppStore } from './store';
import { useT } from './useT';

interface Props {
  person: Person;
  /** De ego van de actieve familie; die mag je niet verwijderen (breekt "ik"). */
  egoId: string;
  /** In een paneel: meteen open, geen toggle/annuleer. */
  embedded?: boolean;
}

/** CRUD: bewerk of verwijder de focuspersoon (eigen boom). */
export function EditPerson({ person, egoId, embedded }: Props) {
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
  const [nickname, setNickname] = useState(person.nickname ?? '');
  // "Toon in boom" is vervangen door de roepnaam; bewaar een eventuele oude waarde.
  const preferredName = person.preferredName;
  const [sex, setSex] = useState<'m' | 'f' | 'x' | ''>(person.sex ?? '');
  const [birthYear, setBirthYear] = useState(String(person.birth?.date?.year ?? ''));
  const [deathYear, setDeathYear] = useState(String(person.death?.date?.year ?? ''));
  const [visibility, setVisibility] = useState<Visibility>(person.visibility);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

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

  // Automatisch opslaan: elke veldwijziging schrijft (debounced) weg; geen
  // opslaan-knop meer. "Voornamen" is verplicht — bij een leeg veld slaan we niet
  // op (anders zou je per ongeluk de naam wissen).
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!given.trim()) return;
    const handle = setTimeout(async () => {
      setSaveState('saving');
      setError(undefined);
      try {
        await updatePerson(person.id, {
          given: given.trim(),
          callName: callName.trim() || undefined,
          familyName: familyName.trim() || undefined,
          nameNative: nameNative.trim() || undefined,
          nickname: nickname.trim() || undefined,
          preferredName,
          sex: sex || undefined,
          birthYear: birthYear ? Number(birthYear) : undefined,
          deathYear: deathYear ? Number(deathYear) : undefined,
          visibility,
        });
        bumpData();
        setSaveState('saved');
      } catch (err) {
        setError(err instanceof Error ? err.message : t.edit.saveFailed);
        setSaveState('idle');
      }
    }, 700);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [given, callName, familyName, nameNative, nickname, preferredName, sex, birthYear, deathYear, visibility]);

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
      <FloatField label={t.edit.firstName} value={given} required
        onChange={(e) => setGiven(e.target.value)} />
      <FloatField label={t.edit.callName} value={callName}
        onChange={(e) => setCallName(e.target.value)} />
      <FloatField label={t.edit.lastName} value={familyName}
        onChange={(e) => setFamilyName(e.target.value)} />
      <SexPicker value={sex} onChange={setSex} />
      <div className="add-rel-row">
        <FloatField label={t.edit.birthAbbr} inputMode="numeric"
          value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ''))} />
        <FloatField label={t.edit.deathAbbr} inputMode="numeric"
          value={deathYear} onChange={(e) => setDeathYear(e.target.value.replace(/\D/g, ''))} />
      </div>
      <FloatField label={t.edit.nativeName} value={nameNative}
        onChange={(e) => setNameNative(e.target.value)} />
      <FloatField label={t.edit.nickname} value={nickname}
        onChange={(e) => setNickname(e.target.value)} />
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
      </div>
      {error && <p className="add-rel-error">{error}</p>}
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
    </form>
  );
}
