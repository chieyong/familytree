import { useEffect, useMemo, useState } from 'react';
import type { FamilyGraph } from './data/types';
import { FixtureRepository } from './data/FixtureRepository';
import type { FamilyRepository } from './data/FamilyRepository';
import { demoFamily } from './data/fixtures/demoFamily';
import habsburgJson from './data/fixtures/habsburg.json';
import { KinshipService } from './domain/kinship';
import { describeRelation } from './domain/relationNaming';
import { FamilyCanvas } from './ui/FamilyCanvas';
import { DATASET_EGO, useAppStore, type DatasetId } from './ui/store';
import { lifespan, shortName } from './ui/theme';

const habsburg = habsburgJson as unknown as FamilyGraph;
const graphByDataset: Record<DatasetId, FamilyGraph> = { demo: demoFamily, habsburg };

export default function App() {
  const { mode, dataset, focusId, ikId, setMode, setDataset, setFocus, setIk } = useAppStore();

  // Enige plek waar een concrete repository gekozen wordt; later: ApiRepository.
  const repository: FamilyRepository = useMemo(
    () => new FixtureRepository(graphByDataset[dataset]),
    [dataset],
  );

  const [fullGraph, setFullGraph] = useState<FamilyGraph>();
  const [egoGraph, setEgoGraph] = useState<FamilyGraph>();

  useEffect(() => {
    repository.getFullGraph().then(setFullGraph);
  }, [repository]);

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
  }, [repository, focusId]);

  const focusPerson = fullGraph?.persons.find((person) => person.id === focusId);

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
        <h1>Familieboom</h1>
        <nav className="mode-toggle" aria-label="Weergave">
          <button className={mode === 'artwork' ? 'active' : ''} onClick={() => setMode('artwork')}>
            Kunstwerk
          </button>
          <button className={mode === 'navigation' ? 'active' : ''} onClick={() => setMode('navigation')}>
            Navigatie
          </button>
        </nav>
      </header>

      <main className="stage">
        {fullGraph && (
          <FamilyCanvas
            key={dataset}
            mode={mode}
            fullGraph={fullGraph}
            egoGraph={egoGraph}
            focusId={focusId}
            branches={branches}
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
              {ikId !== DATASET_EGO[dataset] && (
                <button className="perspective-btn" onClick={() => setIk(DATASET_EGO[dataset])}>
                  terug naar standaard
                </button>
              )}
            </div>
          )}
        </footer>
      )}

      <select
        className="dataset-select"
        aria-label="Dataset"
        value={dataset}
        onChange={(event) => setDataset(event.target.value as DatasetId)}
      >
        <option value="demo">Demo-familie</option>
        <option value="habsburg">Habsburg (Wikidata)</option>
      </select>

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
