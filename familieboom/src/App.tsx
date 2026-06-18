import { useEffect, useMemo, useState } from 'react';
import type { FamilyGraph } from './data/types';
import { FixtureRepository } from './data/FixtureRepository';
import { SupabaseRepository } from './data/SupabaseRepository';
import type { FamilyRepository } from './data/FamilyRepository';
import { demoFamily } from './data/fixtures/demoFamily';
import habsburgJson from './data/fixtures/habsburg.json';
import { KinshipService } from './domain/kinship';
import { describeRelation } from './domain/relationNaming';
import { acceptInvite } from './data/invites';
import { requestFamilyAccess } from './data/bridges';
import { signedAvatarUrls } from './data/mutations';
import { useFamilies } from './ui/useFamilies';
import { supabase } from './data/supabaseClient';
import { PersonPanel } from './ui/PersonPanel';
import { PrivacyInfo } from './ui/PrivacyInfo';
import { AuthBar } from './ui/AuthBar';
import { FamilyCanvas } from './ui/FamilyCanvas';
import { FamilyMenu } from './ui/FamilyMenu';
import { ShareFamily } from './ui/ShareFamily';
import { BACKEND, DATASET_EGO, DATASET_FAMILY_ID, useAppStore, type DatasetId } from './ui/store';
import { lifespan, shortName } from './ui/theme';

const habsburg = habsburgJson as unknown as FamilyGraph;
const graphByDataset: Record<DatasetId, FamilyGraph> = { demo: demoFamily, habsburg };

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="M21 16.5 16 12l-9 6.5" />
    </svg>
  );
}

export default function App() {
  const { mode, dataset, focusId, ikId, theme, photos, activeFamily, bridgeReturn, dataVersion, user, notice, setMode, setFocus, setIk, toggleTheme, togglePhotos, crossTo, crossBack, setAuthOpen, setNotice } =
    useAppStore();
  const { families } = useFamilies();

  // Uitnodiging accepteren: ?invite=<token> → pending lid zodra ingelogd.
  const [inviteToken, setInviteToken] = useState(() =>
    new URLSearchParams(window.location.search).get('invite'),
  );
  const [inviteMsg, setInviteMsg] = useState<string>();
  useEffect(() => {
    if (!inviteToken || !user) return;
    acceptInvite(inviteToken)
      .then((r) => {
        setInviteMsg(
          r.status === 'active'
            ? `Je bent nu lid van ${r.familyName}. Kies 'm in het menu rechtsonder.`
            : `Verzoek voor ${r.familyName} verstuurd — wacht op goedkeuring door de beheerder.`,
        );
      })
      .catch((err) => setInviteMsg(err instanceof Error ? err.message : 'Uitnodiging mislukt'))
      .finally(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url.toString());
        setInviteToken(null);
      });
  }, [inviteToken, user]);

  // Enige plek waar de concrete datalaag gekozen wordt. Een ingelogde "actieve
  // familie" wint; anders een demo-preset (Supabase of fixtures).
  const repository: FamilyRepository = useMemo(() => {
    if (activeFamily) return new SupabaseRepository(activeFamily.id);
    return BACKEND === 'supabase'
      ? new SupabaseRepository(DATASET_FAMILY_ID[dataset])
      : new FixtureRepository(graphByDataset[dataset]);
  }, [dataset, activeFamily]);

  const [fullGraph, setFullGraph] = useState<FamilyGraph>();
  const [egoGraph, setEgoGraph] = useState<FamilyGraph>();
  const [panelOpen, setPanelOpen] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());

  // Ondertekende URL's voor de profielfoto's (privé-bucket). Eén keer per
  // graaf-versie; ze verlopen na een uur en worden bij de volgende load ververst.
  useEffect(() => {
    const paths = fullGraph?.persons.map((p) => p.photoPath).filter((p): p is string => !!p) ?? [];
    if (paths.length === 0) {
      setPhotoUrls(new Map());
      return;
    }
    signedAvatarUrls(paths).then(setPhotoUrls);
  }, [fullGraph]);

  // Foto's per persoon-id (voor canvas + kaart).
  const photoByPerson = useMemo(() => {
    const map = new Map<string, string>();
    fullGraph?.persons.forEach((p) => {
      const url = p.photoPath && photoUrls.get(p.photoPath);
      if (url) map.set(p.id, url);
    });
    return map;
  }, [fullGraph, photoUrls]);

  useEffect(() => {
    repository.getFullGraph().then(setFullGraph);
  }, [repository, dataVersion]);

  useEffect(() => {
    // Depth 2 is de norm; bij zeer vertakte families (royals) wordt dat te
    // druk en vallen we terug op de directe kring.
    repository.getEgoGraph(focusId, 2).then((graph) => {
      if (graph.persons.length <= 34) {
        setEgoGraph(graph);
      } else {
        repository.getEgoGraph(focusId, 1).then(setEgoGraph);
      }
    });
  }, [repository, focusId, dataVersion]);

  // Vangnet: zit de focus/ik niet in de geladen graaf (bv. een uitgenodigde
  // kijker zonder eigen knooppunt), kies dan de eerste persoon.
  useEffect(() => {
    if (!fullGraph || fullGraph.persons.length === 0) return;
    const has = (id: string) => fullGraph.persons.some((p) => p.id === id);
    if (!has(focusId)) setFocus(fullGraph.persons[0].id);
    if (!has(ikId)) setIk(fullGraph.persons[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullGraph]);

  const focusPerson = fullGraph?.persons.find((person) => person.id === focusId);
  const defaultEgo = activeFamily ? activeFamily.ego : DATASET_EGO[dataset];

  // Relatie van de focuspersoon t.o.v. het gekozen perspectief ("ik").
  const ikPerson = fullGraph?.persons.find((person) => person.id === ikId);
  const kinship = useMemo(() => (fullGraph ? new KinshipService(fullGraph) : undefined), [fullGraph]);
  const branches = useMemo(() => kinship?.branches(), [kinship]);
  const relation = useMemo(
    () => (kinship && focusId !== ikId ? describeRelation(kinship, ikId, focusId) : undefined),
    [kinship, ikId, focusId],
  );

  // Oversteken naar de gekoppelde familie: lid → meteen wisselen; geen lid →
  // toegang vragen (de owner van die boom keurt goed).
  const crossBridge = async () => {
    const b = focusPerson?.bridge;
    if (!b) return;
    if (families.some((f) => f.id === b.familyId)) {
      crossTo({ id: b.familyId, ego: b.personId, label: b.familyName });
    } else {
      try {
        const status = await requestFamilyAccess(b.familyId);
        setNotice(
          status === 'active'
            ? `Je hebt al toegang tot familie ${b.familyName}.`
            : `Toegang gevraagd aan familie ${b.familyName} — wacht op goedkeuring.`,
        );
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'Toegang vragen mislukt');
      }
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>Bloom</h1>
        <div className="topbar-right">
          <nav className="mode-toggle" aria-label="Weergave">
            <button className={mode === 'artwork' ? 'active' : ''} onClick={() => setMode('artwork')}>
              Tableau
            </button>
            <button className={mode === 'navigation' ? 'active' : ''} onClick={() => setMode('navigation')}>
              Tree
            </button>
          </nav>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Wissel naar lichte modus' : 'Wissel naar donkere modus'}
            title={theme === 'dark' ? 'Lichte modus' : 'Donkere modus'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          {photoByPerson.size > 0 && (
            <button
              className={`theme-toggle photo-toggle${photos ? ' active' : ''}`}
              onClick={togglePhotos}
              aria-label={photos ? 'Foto’s verbergen' : 'Foto’s tonen'}
              title={photos ? 'Foto’s verbergen' : 'Foto’s tonen'}
            >
              <PhotoIcon />
            </button>
          )}
          <PrivacyInfo />
          <AuthBar />
          <ShareFamily />
        </div>
      </header>

      {inviteToken && !user && supabase && (
        <div className="invite-banner invite-prompt">
          Je bent uitgenodigd voor een familieboom.
          <button className="invite-login" onClick={() => setAuthOpen(true)}>
            Inloggen om deel te nemen
          </button>
        </div>
      )}

      {inviteMsg && (
        <button className="invite-banner" onClick={() => setInviteMsg(undefined)}>
          {inviteMsg} <span className="invite-dismiss">×</span>
        </button>
      )}

      {notice && (
        <button className="invite-banner" onClick={() => setNotice(undefined)}>
          {notice} <span className="invite-dismiss">×</span>
        </button>
      )}

      <main className="stage">
        {fullGraph && (
          <FamilyCanvas
            key={dataset}
            mode={mode}
            fullGraph={fullGraph}
            egoGraph={egoGraph}
            focusId={focusId}
            branches={branches}
            theme={theme}
            photos={photos}
            photoUrls={photoByPerson}
            onFocus={setFocus}
          />
        )}
      </main>

      {focusPerson && (
        <footer className="person-card">
          {photoByPerson.get(focusPerson.id) && (
            <img className="person-card-avatar" src={photoByPerson.get(focusPerson.id)} alt="" />
          )}
          <div className="person-card-main">
            <strong>{shortName(focusPerson)}</strong>
            {focusPerson.nameNative && <span className="name-native">{focusPerson.nameNative}</span>}
            {focusPerson.nickname && <span className="name-nick">‘{focusPerson.nickname}’</span>}
            <span>{lifespan(focusPerson)}</span>
            {focusPerson.birth?.place && <span>{focusPerson.birth.place.name}</span>}
            {activeFamily && (
              <button className="edit-pencil" onClick={() => setPanelOpen(true)} title="Bewerken" aria-label="Bewerken">
                ✎
              </button>
            )}
          </div>
          {bridgeReturn && (
            <div className="person-card-relation">
              <button className="perspective-btn" onClick={crossBack}>
                ← terug naar familie {bridgeReturn.label}
              </button>
            </div>
          )}
          {focusPerson.bridge && (
            <div className="person-card-relation">
              <button className="bridge-cross" onClick={crossBridge}>
                ↗ ook in familie {focusPerson.bridge.familyName}
              </button>
            </div>
          )}
          {relation && ikPerson && (
            <div className="person-card-relation">
              {relation.label} van {shortName(ikPerson)}
              {relation.subtitle && <span> · {relation.subtitle}</span>}
              {relation.also && relation.also.length > 0 && (
                <span> · ook: {relation.also.join(', ')}</span>
              )}
              <button
                className="perspective-btn"
                onClick={() => setIk(focusId)}
                title="Benoem relaties voortaan vanuit deze persoon"
              >
                bekijk vanuit {focusPerson.givenNames[0]}
              </button>
            </div>
          )}
          {focusId === ikId && (
            <div className="person-card-relation">
              huidig perspectief
              {ikId !== defaultEgo && (
                <button className="perspective-btn" onClick={() => setIk(defaultEgo)}>
                  terug naar standaard
                </button>
              )}
            </div>
          )}
        </footer>
      )}

      {activeFamily && panelOpen && focusPerson && (
        <PersonPanel
          key={focusPerson.id}
          person={focusPerson}
          familyId={activeFamily.id}
          egoId={activeFamily.ego}
          graph={fullGraph}
          photoUrl={photoByPerson.get(focusPerson.id)}
          onClose={() => setPanelOpen(false)}
        />
      )}

      <FamilyMenu />

      <details className="legend">
        <summary>Legenda</summary>
        {mode === 'artwork' && (
          <p className="legend-read">
            <strong>Zo lees je het:</strong> tijd stroomt van boven naar
            beneden. Elke verticale lijn is één leven, van geboortepunt tot
            overlijden — de lengte ís de levensduur. Een takje dat een lijn
            verlaat is de geboorte van een kind; een lichte boog tussen twee
            lijnen is een huwelijk, op de hoogte van het trouwjaar. Zoom in
            voor namen.
          </p>
        )}
        <ul>
          {mode === 'artwork' ? (
            <>
              <li><span className="swatch line solid" /> kind ontspringt aan ouderlijn</li>
              <li><span className="swatch line union" /> huwelijk (boog in trouwjaar)</li>
            </>
          ) : (
            <>
              <li><span className="swatch line solid" /> ouder–kind (biologisch)</li>
              <li><span className="swatch line union" /> partnerschap</li>
            </>
          )}
          <li><span className="swatch line ex" /> beëindigd (scheiding)</li>
          <li><span className="swatch line dotted" /> adoptie</li>
          <li><span className="swatch line dashed" /> stief</li>
          <li><span className="swatch dot" /> kleur = stamtak · grootte = nakomelingen</li>
          <li><span className="swatch dot hollow" /> open = overleden</li>
        </ul>
      </details>
    </div>
  );
}
