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
import { FamilyCanvas, type FamilyCanvasHandle } from './ui/FamilyCanvas';
import { GlobeCanvas } from './ui/GlobeCanvas';
import { FamilyMenu } from './ui/FamilyMenu';
import { ShareFamily } from './ui/ShareFamily';
import { ViewAsControl } from './ui/ViewAsControl';
import { OverflowMenu } from './ui/OverflowMenu';
import { Leader } from './ui/Leader';
import { Tour } from './ui/Tour';
import { BACKEND, DATASET_EGO, DATASET_FAMILY_ID, FIXTURES_ONLY_DATASETS, useAppStore, type DatasetId } from './ui/store';
import { useT } from './ui/useT';
import { lifespan, nativeSubline, shortName } from './ui/theme';

const habsburg = habsburgJson as unknown as FamilyGraph;
const graphByDataset: Record<DatasetId, FamilyGraph> = { demo: demoFamily, diaspora: diasporaFamily, habsburg };

export default function App() {
  const { mode, dataset, focusId, ikId, theme, photos, activeFamily, viewAs, bridgeReturn, dataVersion, user, notice, guideOpen, authOpen, globeLayer, treeScope, topbarPop, setMode, setFocus, setIk, crossTo, crossBack, setActiveFamily, setViewAs, setAuthOpen, setAboutOpen, setNotice, bumpData, setTreeScope } =
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
    if (activeFamily) return new SupabaseRepository(activeFamily.id, viewAs);
    const fromSupabase = BACKEND === 'supabase' && !FIXTURES_ONLY_DATASETS.includes(dataset);
    return fromSupabase
      ? new SupabaseRepository(DATASET_FAMILY_ID[dataset])
      : new FixtureRepository(graphByDataset[dataset]);
  }, [dataset, activeFamily, viewAs]);

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

  // Afdrukken (Boom/Tableau; niet Atlas — een draaibare wereldbol leent zich
  // niet voor papier). Oriëntatie hangt van de weergave af (Boom liggend, het
  // brede diagram; Tableau staand, de verticale tijdas); CSS kan @page niet
  // op de weergave conditioneren, dus injecteren we die vlak vóór het
  // printen. De Boom-camera moet bij het printen de hele boom centreren i.p.v.
  // de focuspersoon — dat gebeurt via de ref synchroon, vlak vóór
  // window.print(): een via state getriggerde re-render zou de blokkerende
  // window.print()-aanroep niet altijd op tijd halen.
  const familyCanvasRef = useRef<FamilyCanvasHandle>(null);
  const canPrint = mode !== 'globe';
  const handlePrint = () => {
    const restoreViewBox = familyCanvasRef.current?.preparePrint() ?? null;
    const orientation = mode === 'artwork' ? 'portrait' : 'landscape';
    const style = document.createElement('style');
    style.textContent = `@page { size: ${orientation}; margin: 10mm; }`;
    document.head.appendChild(style);
    const cleanup = () => {
      style.remove();
      restoreViewBox?.();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    // Wacht tot het instellingenmenu uit de print-uitsnede is vóór de dialoog opent.
    requestAnimationFrame(() => window.print());
  };

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

  // Labels voor de "Bekijk als …"-banner. De gesimuleerde persoon is zichtbaar
  // in de (gesimuleerde) graaf, want is_self maakt 'm vol zichtbaar.
  const viewAsRoleLabel = viewAs
    ? viewAs.role === 'viewer'
      ? t.share.roleViewer
      : viewAs.role === 'contributor'
        ? t.share.roleContributor
        : t.share.roleEditor
    : '';
  const viewAsPerson = viewAs?.personId
    ? fullGraph?.persons.find((p) => p.id === viewAs.personId)
    : undefined;
  const viewAsPersonName = viewAsPerson ? shortName(viewAsPerson) : undefined;

  // Alleen owner/editor mag personen bewerken; viewers krijgen een alleen-lezen
  // paneel (de RLS dwingt dit ook af, maar zo tonen we de bewerk-UI niet onnodig).
  // Tijdens "Bekijk als …" is alles alleen-lezen: een mutatie zou als de échte
  // owner draaien (niet als de gesimuleerde rol) en dus misleidend zijn.
  const myRole = activeFamily ? families.find((f) => f.id === activeFamily.id)?.role : undefined;
  const isOwner = myRole === 'owner';
  const canEdit = !viewAs && (myRole === 'owner' || myRole === 'editor');
  const canPropose = !viewAs && myRole === 'contributor';

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

  // "Totaal": de volledige familie, alle generaties helemaal uitgeklapt in
  // één oogopslag (egoLayout op de complete graaf, rond de focuspersoon).
  // De BFS-ego-graaf blijft de "Kring"-stand.
  const showAll = treeScope === 'all';

  // Legenda toont alleen regels die ook echt voorkomen in wat je nu ziet
  // (bv. geen "adoptie" als niemand geadopteerd is). Tableau toont altijd de
  // hele familie (fullGraph); Boom volgt de Kring/Totaal-stand.
  const legendGraph = mode === 'artwork' ? fullGraph : mode === 'navigation' ? (showAll ? fullGraph : egoGraph) : undefined;
  const legendFlags = useMemo(() => {
    const CURRENT_YEAR = 2026;
    const isDeceasedStyle = (person: { death?: unknown; birth?: { date?: { year: number } } }): boolean => {
      if (person.death !== undefined) return true;
      const birthYear = person.birth?.date?.year;
      return birthYear === undefined || birthYear + 100 < CURRENT_YEAR;
    };
    const hasCoords = (place?: { lat?: number; lon?: number }) => place?.lat != null && place?.lon != null;

    const persons = legendGraph?.persons ?? [];
    const parentLinks = legendGraph?.parentLinks ?? [];
    const unions = legendGraph?.unions ?? [];
    const fullPersons = fullGraph?.persons ?? [];
    return {
      hasParentChild: parentLinks.some((l) => l.role !== 'adoptive' && l.role !== 'step' && l.role !== 'foster'),
      hasPartnership: unions.some((u) => !(u.end !== undefined && u.end.reason !== 'death')),
      hasEnded: unions.some((u) => u.end !== undefined && u.end.reason !== 'death'),
      hasAdoption: parentLinks.some((l) => l.role === 'adoptive'),
      hasStep: parentLinks.some((l) => l.role === 'step' || l.role === 'foster'),
      hasDeceased: persons.some(isDeceasedStyle),
      // Atlas kijkt altijd naar de hele familie (net als GlobeCanvas).
      hasGlobeDeceased: fullPersons.some((p) => hasCoords(p.birth?.place) && isDeceasedStyle(p)),
      hasResidenceStops: fullPersons.some((p) => p.residences?.some((r) => hasCoords(r.place))),
      hasDeathStops: fullPersons.some((p) => hasCoords(p.death?.place)),
    };
  }, [legendGraph, fullGraph]);

  // Eén bron van waarheid voor de legenda-regels, gedeeld door het
  // interactieve paneel (verticale lijst) en de afdrukversie (horizontale
  // chips) — zo blijven ze vanzelf identiek en dezelfde filtering toepassen.
  const legendItems = useMemo(() => {
    const items: { swatch?: string; symbol?: string; label: string }[] = [];
    if (mode === 'globe') {
      items.push({ swatch: 'dot', label: t.legend.globeBirth });
      if (globeLayer === 'migration') {
        if (legendFlags.hasGlobeDeceased) items.push({ swatch: 'dot hollow', label: t.legend.globeDeceased });
        items.push({ swatch: 'line solid', label: t.legend.globeMigration });
      } else {
        if (legendFlags.hasResidenceStops) items.push({ swatch: 'dot small', label: t.legend.globeResidence });
        if (legendFlags.hasDeathStops) items.push({ symbol: '✕', label: t.legend.globeDeath });
        items.push({ swatch: 'line solid', label: t.legend.globeLife });
      }
      items.push({ label: t.legend.globeColor });
    } else {
      if (legendFlags.hasParentChild) {
        items.push({ swatch: 'line solid', label: mode === 'artwork' ? t.legend.artworkChild : t.legend.navParentChild });
      }
      if (legendFlags.hasPartnership) {
        items.push({ swatch: 'line union', label: mode === 'artwork' ? t.legend.artworkMarriage : t.legend.navPartnership });
      }
      if (legendFlags.hasEnded) items.push({ swatch: 'line ex', label: t.legend.ended });
      if (legendFlags.hasAdoption) items.push({ swatch: 'line dotted', label: t.legend.adoption });
      if (legendFlags.hasStep) items.push({ swatch: 'line dashed', label: t.legend.step });
      items.push({ swatch: 'dot', label: t.legend.branchSize });
      if (legendFlags.hasDeceased) items.push({ swatch: 'dot hollow', label: t.legend.deceased });
    }
    return items;
  }, [mode, globeLayer, legendFlags, t]);

  // Kop + kengetallen voor de afdrukversie (Boom/Tableau): titel bij voorkeur
  // de eigen familienaam, anders de meest voorkomende achternaam in wat er
  // getoond wordt, anders een generieke titel (bv. Wikidata-imports zonder
  // achternaam-veld, zoals de Habsburg-demo).
  const printMeta = useMemo(() => {
    if (!legendGraph) return null;
    const persons = legendGraph.persons;
    const gens = kinship?.generations();
    const genValues = gens ? persons.map((p) => gens.get(p.id) ?? 0) : [];
    const genSpan = genValues.length ? Math.max(...genValues) - Math.min(...genValues) + 1 : 1;
    const years = persons
      .flatMap((p) => [p.birth?.date?.year, p.death?.date?.year])
      .filter((y): y is number => y !== undefined);
    const yearRange = years.length ? ([Math.min(...years), Math.max(...years)] as const) : undefined;

    const surnameCounts = new Map<string, number>();
    for (const p of persons) {
      if (p.familyName) surnameCounts.set(p.familyName, (surnameCounts.get(p.familyName) ?? 0) + 1);
    }
    const topSurname = [...surnameCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const title = activeFamily?.label || (topSurname ? t.print.familyOf(topSurname) : t.print.fallbackTitle);

    return { title, personCount: persons.length, genSpan, yearRange };
  }, [legendGraph, kinship, activeFamily, t]);

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
          <ViewAsControl isOwner={isOwner} focusName={focusPerson ? shortName(focusPerson) : undefined} />
          <OverflowMenu photosAvailable={photoByPerson.size > 0} onPrint={canPrint ? handlePrint : undefined} />
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

      {viewAs && (
        <div className="invite-banner view-as-banner">
          <span>
            👁 {t.viewAs.banner(viewAsRoleLabel)}
            {viewAsPersonName && <> · {t.viewAs.from(viewAsPersonName)}</>}
          </span>
          <button className="view-as-exit" onClick={() => setViewAs(null)}>
            {t.viewAs.exit}
          </button>
        </div>
      )}

      {canEdit && proposals.length > 0 && (
        <button className="invite-banner" onClick={() => setReviewOpen(true)}>
          {t.proposal.banner(proposals.length)}
        </button>
      )}

      {user && !activeFamily && families.length > 0 && (
        <button
          className="invite-banner invite-open-tree"
          onClick={() => {
            const f = families[0];
            setActiveFamily({ id: f.id, ego: f.selfPersonId ?? '', label: f.name });
          }}
        >
          {families.length === 1 ? t.invite.openTreeNamed(families[0].name) : t.invite.openTree}
        </button>
      )}

      {/* Alleen zichtbaar bij het afdrukken (@media print) van Boom/Tableau. */}
      {printMeta && (
        <div className="print-header">
          <h1>{printMeta.title}</h1>
          <p className="print-stats">
            {t.print.genCount(printMeta.genSpan)} · {t.print.personCount(printMeta.personCount)}
            {printMeta.yearRange && ` · ${printMeta.yearRange[0]}–${printMeta.yearRange[1]}`}
          </p>
          <p className="print-intro">{t.print.intro}</p>
        </div>
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
            ref={familyCanvasRef}
            key={dataset}
            mode={mode}
            fullGraph={fullGraph}
            egoGraph={showAll ? fullGraph : egoGraph}
            focusId={focusId}
            branches={branches}
            theme={theme}
            photos={photos}
            photoUrls={photoByPerson}
            fitAll={showAll}
            onFocus={(id) => { setFocus(id); setCardOpen(true); }}
            onDeselect={() => setCardOpen(false)}
          />
        )}
        {/* Wijkt zolang een topbar-menu open is: de dropdown valt hier overheen. */}
        {fullGraph && mode === 'navigation' && !topbarPop && (
          <div
            className="globe-layers"
            role="group"
            aria-label={t.tree.scopeLabel}
            style={layerAnchor ? { top: layerAnchor.top, right: layerAnchor.right, left: 'auto' } : undefined}
          >
            <button className={showAll ? '' : 'active'} onClick={() => setTreeScope('circle')}>
              {t.tree.circle}
            </button>
            <button className={showAll ? 'active' : ''} onClick={() => setTreeScope('all')}>
              {t.tree.total}
            </button>
          </div>
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
            <ul>
              {legendItems.map((item, i) => (
                <li key={i}>
                  {item.swatch && <span className={`swatch ${item.swatch}`} />}
                  {item.symbol && <span className="swatch-x">{item.symbol}</span>}
                  {' '}{item.label}
                </li>
              ))}
            </ul>
            <button className="legend-credit" onClick={() => setAboutOpen(true)}>
              {t.legend.byMaker}
            </button>
          </>
        )}
      </div>

      {/* Alleen zichtbaar bij het afdrukken: horizontale variant van dezelfde
          legendItems, plus een kleine attributieregel. */}
      {printMeta && (
        <>
          <div className="print-legend">
            {legendItems.map((item, i) => (
              <span className="print-chip" key={i}>
                {item.swatch && <span className={`swatch ${item.swatch}`} />}
                {item.symbol && <span className="swatch-x">{item.symbol}</span>}
                {' '}{item.label}
              </span>
            ))}
          </div>
          <p className="print-footer">{t.print.footer}</p>
        </>
      )}
    </div>
  );
}
