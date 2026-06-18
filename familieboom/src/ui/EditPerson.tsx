import { useEffect, useState } from 'react';
import type { Person, Visibility } from '../data/types';
import { deletePerson, removePersonPhoto, signedAvatarUrls, updatePerson, uploadPersonPhoto } from '../data/mutations';
import { PhotoEditor } from './PhotoEditor';
import { useAppStore } from './store';

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

  const [open, setOpen] = useState(embedded ?? false);
  const [given, setGiven] = useState(person.givenNames[0] ?? '');
  const [familyName, setFamilyName] = useState(person.familyName ?? '');
  const [nameNative, setNameNative] = useState(person.nameNative ?? '');
  const [nickname, setNickname] = useState(person.nickname ?? '');
  const [sex, setSex] = useState<'m' | 'f' | 'x' | ''>(person.sex ?? '');
  const [birthYear, setBirthYear] = useState(String(person.birth?.date?.year ?? ''));
  const [deathYear, setDeathYear] = useState(String(person.death?.date?.year ?? ''));
  const [visibility, setVisibility] = useState<Visibility>(person.visibility);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // Zelden gebruikte velden ingeklapt — maar open als ze al gevuld zijn.
  const [showMore, setShowMore] = useState(
    !!(person.nameNative || person.nickname || person.visibility !== 'family'),
  );

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
      setError(err instanceof Error ? err.message : 'Foto uploaden mislukt');
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
      setError(err instanceof Error ? err.message : 'Foto verwijderen mislukt');
    } finally {
      setPhotoBusy(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await updatePerson(person.id, {
        given: given.trim(),
        familyName: familyName.trim() || undefined,
        nameNative: nameNative.trim() || undefined,
        nickname: nickname.trim() || undefined,
        sex: sex || undefined,
        birthYear: birthYear ? Number(birthYear) : undefined,
        deathYear: deathYear ? Number(deathYear) : undefined,
        visibility,
      });
      bumpData();
      if (!embedded) setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan mislukt');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`${person.givenNames[0] ?? 'Deze persoon'} verwijderen? Relaties vervallen.`)) return;
    setBusy(true);
    setError(undefined);
    try {
      await deletePerson(person.id);
      bumpData();
      if (!embedded) setOpen(false);
      if (activeFamily) setFocus(activeFamily.ego); // terug naar jezelf
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verwijderen mislukt');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button className="add-rel-btn edit-toggle" onClick={() => setOpen(true)}>
        ✎ bewerken
      </button>
    );
  }

  return (
    <form className="add-relative-form" onSubmit={save}>
      <div className="edit-photo">
        {photoUrl ? (
          <img className="edit-photo-preview" src={photoUrl} alt="" />
        ) : (
          <div className="edit-photo-empty" aria-hidden="true">+</div>
        )}
        <div className="edit-photo-actions">
          <label className="link-btn file-label">
            {photoBusy ? 'Bezig…' : photoUrl ? 'Foto vervangen' : 'Foto kiezen'}
            <input type="file" accept="image/*" onChange={onPickFile} disabled={photoBusy} hidden />
          </label>
          <button type="button" className="link-btn" onClick={() => setEditor({ camera: true })} disabled={photoBusy}>
            Camera
          </button>
          {photoUrl && (
            <button type="button" className="link-btn link-danger" onClick={onRemovePhoto} disabled={photoBusy}>
              verwijderen
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
      <input placeholder="Voornaam" value={given} required
        onChange={(e) => setGiven(e.target.value)} />
      <input placeholder="Achternaam" value={familyName}
        onChange={(e) => setFamilyName(e.target.value)} />
      <div className="add-rel-row">
        <select value={sex} onChange={(e) => setSex(e.target.value as typeof sex)}>
          <option value="">geslacht</option>
          <option value="f">v</option>
          <option value="m">m</option>
          <option value="x">x</option>
        </select>
        <input className="add-rel-year" placeholder="geb." inputMode="numeric"
          value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ''))} />
        <input className="add-rel-year" placeholder="overl." inputMode="numeric"
          value={deathYear} onChange={(e) => setDeathYear(e.target.value.replace(/\D/g, ''))} />
      </div>
      {showMore ? (
        <>
          <input placeholder="Naam in eigen schrift (林麗莎, Иван…)" value={nameNative}
            onChange={(e) => setNameNative(e.target.value)} />
          <input placeholder="Bijnaam / roepnaam" value={nickname}
            onChange={(e) => setNickname(e.target.value)} />
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
            <option value="family">zichtbaar voor familie</option>
            <option value="private">privé (alleen beheerder)</option>
            <option value="public">openbaar</option>
          </select>
        </>
      ) : (
        <button type="button" className="more-toggle" onClick={() => setShowMore(true)}>
          meer details ▾
        </button>
      )}
      {error && <p className="add-rel-error">{error}</p>}
      <div className="add-rel-row">
        <button type="submit" disabled={busy}>{busy ? '…' : 'Opslaan'}</button>
        {!embedded && (
          <button type="button" className="add-rel-cancel" onClick={() => setOpen(false)}>annuleer</button>
        )}
      </div>
      {person.id !== egoId && (
        <button type="button" className="delete-btn" onClick={remove} disabled={busy}>
          verwijderen
        </button>
      )}
    </form>
  );
}
