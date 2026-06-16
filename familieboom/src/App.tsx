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

export default function App() {
  const { mode, dataset, focusId, ikId, theme, activeFamily, dataVersion, user, setMode, setFocus, setIk, toggleTheme } =
    useAppStore();

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
          <PrivacyInfo />
          <AuthBar />
          <ShareFamily />
        </div>
      </header>

      {inviteMsg && (
        <button className="invite-banner" onClick={() => setInviteMsg(undefined)}>
          {inviteMsg} <span className="invite-dismiss">×</span>
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
            onFocus={setFocus}
          />
        )}
      </main>

      {focusPerson && (
        <footer className="person-card">
          <div className="person-card-main">
            <strong>{shortName(focusPerson)}</strong>
            <span>{lifespan(focusPerson)}</span>
            {focusPerson.birth?.place && <span>{focusPerson.birth.place.name}</span>}
          </div>
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
          {activeFamily && (
            <button className="edit-pencil" onClick={() => setPanelOpen(true)} title="Bewerken" aria-label="Bewerken">
              ✎
            </button>
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
