import { useEffect, useMemo, useRef, useState } from 'react';
import type { FamilyGraph } from './data/types';
import { FixtureRepository } from './data/FixtureRepository';
import { SupabaseRepository } from './data/SupabaseRepository';
import type { FamilyRepository } from './data/FamilyRepository';
import { demoFamily } from './data/fixtures/demoFamily';
import { diasporaFamily } from './data/fixtures/diaspora';
import habsburgJson from './data/fixtures/habsburg.json';
import { KinshipService } from './domain/kinship';
import { describeRelation } from './domain/relationNaming';
import { acceptInvite } from './data/invites';
import { requestFamilyAccess } from './data/bridges';
import { signedAvatarUrls } from './data/mutations';
import { useFamilies } from './ui/useFamilies';
import { supabase } from './data/supabaseClient';
import { PersonPanel } from './ui/PersonPanel';
import { HelpGuide } from './ui/HelpGuide';
import { WelcomeCard } from './ui/WelcomeCard';
import { AboutCard } from './ui/AboutCard';
import { ProposalsReview } from './ui/ProposalsReview';
import { listPendingProposals, type Proposal } from './data/mutations';
import { AuthBar } from './ui/AuthBar';
import { FamilyCanvas } from './ui/FamilyCanvas';
import { GlobeCanvas } from './ui/GlobeCanvas';
import { FamilyMenu } from './ui/FamilyMenu';
import { ShareFamily } from './ui/ShareFamily';
import { OverflowMenu } from './ui/OverflowMenu';
import { Leader } from './ui/Leader';
import { Tour } from './ui/Tour';
import { BACKEND, DATASET_EGO, DATASET_FAMILY_ID, FIXTURES_ONLY_DATASETS, useAppStore, type DatasetId } from './ui/store';
import { useT } from './ui/useT';
import { lifespan, nativeSubline, shortName } from './ui/theme';

const habsburg = habsburgJson as unknown as FamilyGraph;
const graphByDataset: Record<DatasetId, FamilyGraph> = { demo: demoFamily, diaspora: diasporaFamily, habsburg };

export default function App() {
  const { mode, dataset, focusId, ikId, theme, photos, activeFamily, bridgeReturn, dataVersion, user, notice, guideOpen, authOpen, globeLayer, setMode, setFocus, setIk, crossTo, crossBack, setActiveFamily, setAuthOpen, setAboutOpen, setNotice, bumpData } =
    useAppStore();
  const t = useT();
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
            ? t.invite.nowMember(r.familyName)
            : t.invite.requestSent(r.familyName),
        );
      })
      .catch((err) => setInviteMsg(err instanceof Error ? err.message : t.invite.failed))
      .finally(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url.toString());
        setInviteToken(null);
      });
  }, [inviteToken, user]);

  // Enige plek waar de concrete datalaag gekozen wordt. Een ingelogde "actieve
  // familie" wint; anders een demo-preset. Fixtures-only demo's (diaspora) laden
  // altijd lokaal, ook met de supabase-backend (ze staan niet in de DB).
  const repository: FamilyRepository = useMemo(() => {
    if (activeFamily) return new SupabaseRepository(activeFamily.id);
    const fromSupabase = BACKEND === 'supabase' && !FIXTURES_ONLY_DATASETS.includes(dataset);
    return fromSupabase
      ? new SupabaseRepository(DATASET_FAMILY_ID[dataset])
      : new FixtureRepository(graphByDataset[dataset]);
  }, [dataset, activeFamily]);

  const [fullGraph, setFullGraph] = useState<FamilyGraph>();
  const [egoGraph, setEgoGraph] = useState<FamilyGraph>();
  const [panelOpen, setPanelOpen] = useState(false);
  // Persoonskaart alleen tonen als een node is geselecteerd; klik op leeg vlak
  // deselecteert. Legenda sluit bij een klik buiten (zoals de menu's).
  const [cardOpen, setCardOpen] = useState(false);
  // Op desktop staat de legenda standaard open (en blijft open bij het wisselen
  // van weergave); de gebruiker kan 'm sluiten. Op smal scherm start hij dicht.
  const [legendOpen, setLegendOpen] = useState(() => window.innerWidth >= 900);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);

  // De Atlas-laagtoggle staat net onder de Boom/Tableau/Atlas-toggle. We meten de
  // positie van die view-toggle (verandert bij resize/wrappen/login) en geven 'm door.
  const modeToggleRef = useRef<HTMLElement>(null);
  const [layerAnchor, setLayerAnchor] = useState<{ top: number; right: number }>();
  useEffect(() => {
    const el = modeToggleRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      // Aan de RECHTERrand van de view-toggle hangen (groeit naar links) zodat de
      // toggle nooit rechts buiten beeld steekt — dat gaf horizontale overflow.
      setLayerAnchor({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(document.documentElement);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [mode, user, activeFamily]);

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

  // Alleen owner/editor mag personen bewerken; viewers krijgen een alleen-lezen
  // paneel (de RLS dwingt dit ook af, maar zo tonen we de bewerk-UI niet onnodig).
  const myRole = activeFamily ? families.find((f) => f.id === activeFamily.id)?.role : undefined;
  const canEdit = myRole === 'owner' || myRole === 'editor';
  const canPropose = myRole === 'contributor';

  // Open voorstellen ophalen voor owner/editor (en herladen na een mutatie).
  useEffect(() => {
    if (!activeFamily || !canEdit) {
      setProposals([]);
      return;
    }
    listPendingProposals(activeFamily.id)
      .then(setProposals)
      .catch(() => setProposals([]));
  }, [activeFamily, canEdit, dataVersion]);

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
            ? t.bridgeCross.alreadyAccess(b.familyName)
            : t.bridgeCross.requested(b.familyName),
        );
      } catch (err) {
        setNotice(err instanceof Error ? err.message : t.bridgeCross.failed);
      }
    }
  };

  return (
    <div className="app">
      <Leader ready={!!fullGraph} />
      <Tour />
      <header className="topbar">
        <h1>Bloom</h1>
        <div className="topbar-right">
          <nav className="mode-toggle" aria-label={t.topbar.viewLabel} ref={modeToggleRef}>
            <button className={mode === 'navigation' ? 'active' : ''} onClick={() => setMode('navigation')}>
              {t.topbar.tree}
            </button>
            <button className={mode === 'artwork' ? 'active' : ''} onClick={() => setMode('artwork')}>
              {t.topbar.tableau}
            </button>
            <button className={mode === 'globe' ? 'active' : ''} onClick={() => setMode('globe')}>
              {t.topbar.globe}
            </button>
          </nav>
          <OverflowMenu photosAvailable={photoByPerson.size > 0} />
          <AuthBar />
          <ShareFamily />
          <HelpGuide />
        </div>
      </header>

      {inviteToken && !user && supabase && (
        <div className="invite-banner invite-prompt">
          {t.invite.banner}
          <button className="invite-login" onClick={() => setAuthOpen(true)}>
            {t.invite.loginToJoin}
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

      {canEdit && proposals.length > 0 && (
        <button className="invite-banner" onClick={() => setReviewOpen(true)}>
          {t.proposal.banner(proposals.length)}
        </button>
      )}

      {user && !activeFamily && families.length > 0 && (
        <button
          className="invite-banner"
          onClick={() => {
            const f = families[0];
            setActiveFamily({ id: f.id, ego: f.selfPersonId ?? '', label: f.name });
          }}
        >
          {families.length === 1 ? t.invite.openTreeNamed(families[0].name) : t.invite.openTree}
        </button>
      )}

      <main className="stage">
        {fullGraph && mode === 'globe' && (
          <GlobeCanvas
            key={`globe-${dataset}`}
            fullGraph={fullGraph}
            branches={branches}
            focusId={focusId}
            theme={theme}
            layerAnchor={layerAnchor}
            onFocus={(id) => { setFocus(id); setCardOpen(true); }}
            onDeselect={() => setCardOpen(false)}
          />
        )}
        {fullGraph && mode !== 'globe' && (
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
            onFocus={(id) => { setFocus(id); setCardOpen(true); }}
            onDeselect={() => setCardOpen(false)}
          />
        )}
      </main>

      {focusPerson && cardOpen && !guideOpen && !authOpen && (
        <footer
          className={`person-card${activeFamily ? ' card-clickable' : ''}`}
          onClick={() => activeFamily && setPanelOpen(true)}
          title={activeFamily ? t.card.openDetails : undefined}
        >
          {photoByPerson.get(focusPerson.id) && (
            <img className="person-card-avatar" src={photoByPerson.get(focusPerson.id)} alt="" />
          )}
          <div className="person-card-main">
            <strong>{shortName(focusPerson)}</strong>
            {nativeSubline(focusPerson) && <span className="name-native">{nativeSubline(focusPerson)}</span>}
            {focusPerson.nickname && focusPerson.preferredName !== 'nickname' && <span className="name-nick">‘{focusPerson.nickname}’</span>}
            <span>{lifespan(focusPerson)}</span>
            {focusPerson.birth?.place && <span>{focusPerson.birth.place.name}</span>}
          </div>
          {bridgeReturn && (
            <div className="person-card-relation">
              <button className="perspective-btn" onClick={(e) => { e.stopPropagation(); crossBack(); }}>
                {t.card.backToFamily(bridgeReturn.label)}
              </button>
            </div>
          )}
          {focusPerson.bridge && (
            <div className="person-card-relation">
              <button className="bridge-cross" onClick={(e) => { e.stopPropagation(); crossBridge(); }}>
                {t.card.alsoInFamily(focusPerson.bridge.familyName)}
              </button>
            </div>
          )}
          {relation && ikPerson && (
            <div className="person-card-relation">
              {relation.label} van {shortName(ikPerson)}
              {relation.subtitle && <span> · {relation.subtitle}</span>}
              {relation.also && relation.also.length > 0 && (
                <span> · {t.card.also(relation.also.join(', '))}</span>
              )}
              <button
                className="perspective-btn"
                onClick={(e) => { e.stopPropagation(); setIk(focusId); }}
                title={t.card.viewFromTitle}
              >
                {t.card.viewFrom(focusPerson.givenNames[0])}
              </button>
            </div>
          )}
          {focusId === ikId && (
            <div className="person-card-relation">
              {t.card.currentPerspective}
              {ikId !== defaultEgo && (
                <button className="perspective-btn" onClick={(e) => { e.stopPropagation(); setIk(defaultEgo); }}>
                  {t.card.backToDefault}
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
          canEdit={canEdit}
          canPropose={canPropose}
          onClose={() => setPanelOpen(false)}
        />
      )}

      <FamilyMenu />
      <WelcomeCard />
      <AboutCard />

      {reviewOpen && (
        <ProposalsReview
          proposals={proposals}
          onClose={() => setReviewOpen(false)}
          onResolved={() => bumpData()}
        />
      )}

      {legendOpen && <div className="legend-backdrop" onClick={() => setLegendOpen(false)} />}
      <div className="legend">
        <button className="legend-summary" onClick={() => setLegendOpen((o) => !o)}>
          {t.legend.title}
        </button>
        {legendOpen && (
          <>
            {mode === 'artwork' && <p className="legend-read">{t.legend.artworkRead}</p>}
            {mode === 'globe' && <p className="legend-read">{t.legend.globeRead}</p>}
            <p className="legend-story">{t.legend.story}</p>
            {mode === 'globe' ? (
              <ul>
                <li><span className="swatch dot" /> {t.legend.globeBirth}</li>
                {globeLayer === 'migration' ? (
                  <>
                    <li><span className="swatch dot hollow" /> {t.legend.globeDeceased}</li>
                    <li><span className="swatch line solid" /> {t.legend.globeMigration}</li>
                  </>
                ) : (
                  <>
                    <li><span className="swatch dot small" /> {t.legend.globeResidence}</li>
                    <li><span className="swatch-x">✕</span> {t.legend.globeDeath}</li>
                    <li><span className="swatch line solid" /> {t.legend.globeLife}</li>
                  </>
                )}
                <li>{t.legend.globeColor}</li>
              </ul>
            ) : (
              <ul>
                {mode === 'artwork' ? (
                  <>
                    <li><span className="swatch line solid" /> {t.legend.artworkChild}</li>
                    <li><span className="swatch line union" /> {t.legend.artworkMarriage}</li>
                  </>
                ) : (
                  <>
                    <li><span className="swatch line solid" /> {t.legend.navParentChild}</li>
                    <li><span className="swatch line union" /> {t.legend.navPartnership}</li>
                  </>
                )}
                <li><span className="swatch line ex" /> {t.legend.ended}</li>
                <li><span className="swatch line dotted" /> {t.legend.adoption}</li>
                <li><span className="swatch line dashed" /> {t.legend.step}</li>
                <li><span className="swatch dot" /> {t.legend.branchSize}</li>
                <li><span className="swatch dot hollow" /> {t.legend.deceased}</li>
              </ul>
            )}
            <button className="legend-credit" onClick={() => setAboutOpen(true)}>
              {t.legend.byMaker}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
