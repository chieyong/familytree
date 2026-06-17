import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import type { FamilyGraph, Person, PersonID } from '../data/types';
import { flowLayout } from '../layout/flowLayout';
import { egoLayout } from '../layout/egoLayout';
import { affinePath } from '../layout/transform';
import type { LayoutLink, LayoutNode } from '../layout/types';
import type { ViewMode } from './store';
import { branchColor, lifespan, linkStyle, PALETTES, shortName, type ThemeName } from './theme';

interface Props {
  mode: ViewMode;
  fullGraph: FamilyGraph;
  egoGraph?: FamilyGraph;
  focusId: PersonID;
  branches?: Map<PersonID, number>;
  theme: ThemeName;
  /** Profielfoto's tonen in de boom (focus + inzoomen). */
  photos: boolean;
  /** Ondertekende foto-URL per persoon-id. */
  photoUrls: Map<PersonID, string>;
  onFocus: (id: PersonID) => void;
}

const LABEL_ZOOM = 1.5;
const CURRENT_YEAR = 2026;

const spring = { type: 'spring', stiffness: 110, damping: 20 } as const;

/** Intro speelt één keer per dataset per sessie. */
const playedIntro = new WeakSet<FamilyGraph>();

const truncate = (value: string, max = 16): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const isDeceasedStyle = (person: Person): boolean => {
  if (person.death !== undefined) return true;
  const birthYear = person.birth?.date?.year;
  return birthYear === undefined || birthYear + 100 < CURRENT_YEAR;
};

/**
 * Eén canvas voor beide weergaven. Kunstwerk en navigatie zijn twee layouts
 * op dezelfde personen en relaties; bij het omschakelen reizen de gedeelde
 * nodes en lijnen (springs) naar hun nieuwe plek, terwijl view-exclusieve
 * elementen (levenslijnen, tijdas, de rest van de familie) in- of uitfaden.
 */
export function FamilyCanvas({ mode, fullGraph, egoGraph, focusId, branches, theme, photos, photoUrls, onFocus }: Props) {
  const art = useMemo(() => flowLayout(fullGraph), [fullGraph]);
  const [minX, minY, width, height] = art.bounds;

  const palette = PALETTES[theme];
  const bc = (branch: number) => branchColor(branch, theme);

  // Werkelijke schermmaat: de navigatie-schaal en tikvlakken denken in
  // schermpixels, anders worden nodes op een telefoon onraakbaar klein.
  const svgRef = useRef<SVGSVGElement>(null);
  const [clientSize, setClientSize] = useState({ cw: 1200, ch: 800 });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width: cw, height: ch } = entry.contentRect;
      if (cw > 0 && ch > 0) setClientSize({ cw, ch });
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  // Schermpixels per user-unit bij zoomniveau 1 ("meet": kleinste ratio wint).
  const screenScale = Math.min(clientSize.cw / width, clientSize.ch / height) || 1;

  // Navigatie-layout, geprojecteerd in de canvas-ruimte van het kunstwerk.
  const nav = useMemo(() => {
    if (!egoGraph) return undefined;
    const raw = egoLayout(egoGraph, focusId, branches);
    const [nx, ny, nw, nh] = raw.bounds;
    // Fit binnen het zichtbare vlak (incl. letterbox-ruimte), geklemd op een
    // leesbare nodegrootte in schérmpixels (r ≈ 13–30 px); wat niet past is
    // bereikbaar via pannen.
    const visW = clientSize.cw / screenScale;
    const visH = clientSize.ch / screenScale;
    const kFit = Math.min(visW / nw, visH / nh) * 0.9;
    const k = Math.min(Math.max(kFit, 13 / (22 * screenScale)), 30 / (22 * screenScale));
    const tx = minX + width / 2 - (nx + nw / 2) * k;
    const ty = minY + height / 2 - (ny + nh / 2) * k;
    return {
      k,
      nodes: new Map<PersonID, LayoutNode>(
        raw.nodes.map((n) => [n.person.id, { ...n, x: n.x * k + tx, y: n.y * k + ty, r: n.r * k }]),
      ),
      links: new Map<string, LayoutLink>(
        raw.links.map((l) => [l.id, { ...l, path: affinePath(l.path, k, tx, ty) }]),
      ),
    };
  }, [egoGraph, focusId, branches, width, height, minX, minY, clientSize, screenScale]);

  const isNav = mode === 'navigation' && nav !== undefined;

  // Camera: pan/zoom in beide modi.
  const behaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>(null);
  const [view, setView] = useState<ZoomTransform>(zoomIdentity);
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 9])
      // Een tik op een telefoon beweegt altijd een paar pixels; zonder
      // ruime clickDistance onderdrukt d3-zoom dan elk click-event.
      .clickDistance(12)
      .on('zoom', (event) => setView(event.transform));
    behaviorRef.current = behavior;
    select(svg).call(behavior);
    return () => {
      select(svg).on('.zoom', null);
    };
  }, []);
  // Bij moduswissel: vloeiend terug naar het overzicht.
  useEffect(() => {
    const svg = svgRef.current;
    const behavior = behaviorRef.current;
    if (svg && behavior) {
      select(svg).transition().duration(550).call(behavior.transform, zoomIdentity);
    }
  }, [mode]);
  // Bij hernavigeren in de navigatie: behoud het zoomniveau van de gebruiker,
  // glijd alleen terug naar het midden (waar de nieuwe focuspersoon landt).
  // In het kunstwerk blijft de camera bij een tik volledig met rust.
  const isNavRef = useRef(isNav);
  isNavRef.current = isNav;
  useEffect(() => {
    const svg = svgRef.current;
    const behavior = behaviorRef.current;
    if (!svg || !behavior || !isNavRef.current) return;
    const k = viewRef.current.k;
    const cx = minX + width / 2;
    const cy = minY + height / 2;
    const centered = zoomIdentity.translate(cx * (1 - k), cy * (1 - k)).scale(k);
    select(svg).transition().duration(550).call(behavior.transform, centered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  // Intro (alleen kunstwerk, één keer per dataset).
  const reducedMotion = useReducedMotion();
  const [intro, setIntro] = useState(
    () => mode === 'artwork' && !reducedMotion && !playedIntro.has(fullGraph),
  );
  useEffect(() => {
    if (!intro) return;
    playedIntro.add(fullGraph);
    const timer = setTimeout(() => setIntro(false), 3800);
    return () => clearTimeout(timer);
  }, [intro, fullGraph]);
  useEffect(() => {
    if (mode === 'navigation' && intro) setIntro(false);
  }, [mode, intro]);

  const heroId = useMemo(
    () => art.nodes.reduce((a, b) => (b.r > a.r ? b : a), art.nodes[0])?.person.id,
    [art],
  );
  const heroLinks = useMemo(
    () => art.links.filter((l) => l.sourceId === heroId || l.targetId === heroId),
    [art, heroId],
  );
  const heroLinkDelay = useMemo(
    () => new Map(heroLinks.map((l, i) => [l.id, 1.6 + i * 0.07])),
    [heroLinks],
  );
  const heroChildren = useMemo(
    () => new Set(heroLinks.filter((l) => l.kind === 'parent').map((l) => l.targetId)),
    [heroLinks],
  );
  const introDelayFor = (id: PersonID): number =>
    id === heroId ? 0.3 : heroChildren.has(id) ? 2.1 : 2.6;

  const showArtLabels = !isNav && view.k >= LABEL_ZOOM;
  const thin = (w: number) => w / Math.sqrt(view.k);

  // Selectie via dichtstbijzijnde node i.p.v. overlappende tikvlakken: in een
  // dichte tableau (royals) wint zo de node onder je vinger, niet de bovenste
  // in DOM-volgorde. Eén handler op het canvas, werkt bij elke zoom/dichtheid.
  const contentRef = useRef<SVGGElement>(null);
  const handleCanvasClick = (event: MouseEvent<SVGSVGElement>) => {
    const g = contentRef.current;
    const ctm = g?.getScreenCTM();
    if (!g || !ctm) return;
    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    let bestId: PersonID | null = null;
    let bestDist = Infinity;
    let bestR = 0;
    for (const node of art.nodes) {
      const navNode = nav?.nodes.get(node.person.id);
      if (isNav && !navNode) continue; // verborgen buiten de ego-kring
      const ax = isNav && navNode ? navNode.x : node.x;
      const ay = isNav && navNode ? navNode.y : node.y;
      const dist = Math.hypot(local.x - ax, local.y - ay);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = node.person.id;
        bestR = isNav && navNode ? navNode.r : node.r;
      }
    }
    if (bestId === null) return;
    // Afstand naar schermpixels; ruim, maar genoeg om lege klikken te negeren.
    const pxPerUnit = screenScale * view.k;
    if (bestDist * pxPerUnit <= Math.max(30, bestR * pxPerUnit + 12)) onFocus(bestId);
  };

  return (
    <svg
      ref={svgRef}
      className="viz"
      viewBox={`${minX} ${minY} ${width} ${height}`}
      onClick={handleCanvasClick}
    >
      <defs>
        <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Ronde uitsnede voor profielfoto's, schaalt mee met elke node. */}
        <clipPath id="avatar-clip" clipPathUnits="objectBoundingBox">
          <circle cx="0.5" cy="0.5" r="0.5" />
        </clipPath>
      </defs>

      <g ref={contentRef} transform={view.toString()}>
        {/* Tijdas + levenslijnen: alleen in het kunstwerk */}
        <motion.g
          animate={{ opacity: isNav ? 0 : 1 }}
          transition={{ duration: 0.6 }}
          style={{ pointerEvents: 'none' }}
        >
          {art.decades.map((decade) => (
            <motion.g
              key={decade.year}
              {...(intro ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 0.1, duration: 0.8 } } : {})}
            >
              <line
                x1={minX}
                x2={minX + width}
                y1={decade.y}
                y2={decade.y}
                stroke={palette.axis}
                strokeWidth={thin(0.5)}
                opacity={0.07}
              />
              <text x={minX + 14} y={decade.y - 4} className="decade-label">
                {decade.year}
              </text>
            </motion.g>
          ))}
          {art.lifelines.map((line) => {
            const baseOpacity = (line.living ? 0.26 : 0.42) * palette.lineBoost;
            const isHero = intro && line.id === heroId;
            return (
              <motion.path
                key={line.id}
                d={line.path}
                fill="none"
                stroke={bc(line.branch)}
                strokeWidth={thin(isHero ? 2.8 : 2.4)}
                strokeLinecap="round"
                opacity={isHero ? 0.85 : baseOpacity}
                {...(isHero
                  ? {
                      initial: { pathLength: 0 },
                      animate: { pathLength: 1, opacity: [0.85, 0.85, baseOpacity] },
                      transition: {
                        pathLength: { delay: 0.4, duration: 1.5, ease: 'easeInOut' },
                        opacity: { delay: 2.6, duration: 1 },
                      },
                    }
                  : intro
                    ? { initial: { opacity: 0 }, animate: { opacity: baseOpacity }, transition: { delay: 2.6, duration: 0.8 } }
                    : {})}
              />
            );
          })}
        </motion.g>

        {/* Relaties: morph tussen kunstwerk- en navigatiepaden */}
        {art.links.map((link) => {
          const sourceNode = art.nodes.find((n) => n.person.id === link.sourceId);
          const color = bc(sourceNode?.branch ?? 0);
          const navLink = nav?.links.get(link.id);
          const style = linkStyle(link, color, palette);
          let opacity = style.opacity * palette.lineBoost;
          let strokeWidth = style.strokeWidth;
          if (!isNav) {
            if (link.kind === 'union') {
              // In het kunstwerk zijn huwelijksbogen ondersteunend, geen ringen.
              strokeWidth *= 0.7;
              opacity *= 0.6;
            }
            strokeWidth = thin(strokeWidth);
          } else if (navLink) {
            const touchesEgo = link.sourceId === focusId || link.targetId === focusId;
            const base = touchesEgo ? Math.min(1, style.opacity + 0.25) : style.opacity * 0.35;
            opacity = base * palette.lineBoost;
            strokeWidth = (touchesEgo ? style.strokeWidth + 0.8 : style.strokeWidth) * (nav?.k ?? 1);
          } else {
            opacity = 0; // buiten de ego-kring: lost op in de achtergrond
          }
          const d = isNav && navLink ? navLink.path : link.path;
          const heroDelay = intro ? heroLinkDelay.get(link.id) : undefined;
          const draw = heroDelay !== undefined && !style.dash;
          return (
            <motion.path
              key={link.id}
              initial={false}
              animate={{ d, opacity }}
              transition={spring}
              d={d}
              fill="none"
              stroke={style.stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={style.dash}
              strokeLinecap="round"
              {...(draw
                ? {
                    initial: { pathLength: 0, opacity },
                    animate: { d, pathLength: 1, opacity },
                    transition: { delay: heroDelay, duration: 0.5, ease: 'easeOut' },
                  }
                : heroDelay !== undefined || (intro && !isNav)
                  ? {
                      initial: { opacity: 0 },
                      animate: { d, opacity },
                      transition: { delay: heroDelay ?? 2.6, duration: 0.8 },
                    }
                  : {})}
            />
          );
        })}

        {/* Personen: reizen tussen de twee layouts */}
        {art.nodes.map((artNode) => {
          const id = artNode.person.id;
          const navNode = nav?.nodes.get(id);
          const active = isNav && navNode ? navNode : artNode;
          const hidden = isNav && !navNode;
          const color = bc(artNode.branch);
          const deceased = isDeceasedStyle(artNode.person);
          const isFocus = id === focusId;
          const navK = nav?.k ?? 1;
          const labelY = active.r + (16 + (navNode?.labelTier ? 26 : 0)) * navK;
          // Foto alleen in de boom, op de gekozen persoon of zodra een node
          // groot genoeg op het scherm is (inzoomen). Houdt de periferie rustig.
          const photoUrl = photoUrls.get(id);
          const showPhoto = isNav && photos && !!photoUrl && (isFocus || active.r * screenScale * view.k >= 30);
          return (
            <motion.g
              key={id}
              initial={false}
              animate={{
                x: active.x,
                y: active.y,
                opacity: hidden ? 0 : 1,
              }}
              transition={{ default: spring, opacity: { duration: 0.25, ease: 'easeOut' } }}
              className="art-node"
              style={{ pointerEvents: 'none' }}
            >
              <motion.g
                {...(intro && !isNav
                  ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: introDelayFor(id), duration: 0.8 } }
                  : {})}
              >
                {isFocus && (
                  // Focusring met een minimum in schermpixels: ook op een
                  // minuscule kunstwerk-node is de selectie zichtbaar.
                  <motion.circle
                    animate={{ r: Math.max(active.r + 7, 13 / (screenScale * view.k)) }}
                    transition={spring}
                    fill="none"
                    stroke={palette.focusRing}
                    strokeWidth={thin(1.2)}
                    opacity={0.85}
                  />
                )}
                <motion.circle
                  animate={{ r: active.r }}
                  transition={spring}
                  fill={deceased ? palette.deceasedFill : color}
                  stroke={color}
                  strokeWidth={deceased ? 1.6 : 0}
                  opacity={0.95}
                  filter="url(#glow)"
                />
                {showPhoto && (
                  <g>
                    <image
                      href={photoUrl}
                      x={-active.r}
                      y={-active.r}
                      width={active.r * 2}
                      height={active.r * 2}
                      clipPath="url(#avatar-clip)"
                      preserveAspectRatio="xMidYMid slice"
                    />
                    {/* Tak-kleur blijft als ring om de foto. */}
                    <circle r={active.r} fill="none" stroke={color} strokeWidth={thin(2.5)} opacity={0.9} />
                  </g>
                )}
                {/* Navigatie-labels */}
                <motion.g
                  animate={{ opacity: isNav && navNode ? 1 : 0 }}
                  transition={{ duration: 0.45 }}
                  style={{ pointerEvents: 'none' }}
                >
                  <text
                    y={4 * navK}
                    textAnchor="middle"
                    className="nav-initial"
                    style={{ fontSize: 16 * navK }}
                    fill={deceased ? color : palette.nodeText}
                    opacity={showPhoto ? 0 : 1}
                  >
                    {artNode.person.givenNames[0]?.[0]}
                  </text>
                  <text
                    y={labelY}
                    textAnchor="middle"
                    className="label-name"
                    style={{ fontSize: 14.5 * navK }}
                  >
                    {truncate(shortName(artNode.person))}
                  </text>
                  {artNode.person.nameNative && (
                    <text
                      y={labelY + 13 * navK}
                      textAnchor="middle"
                      className="label-native"
                      style={{ fontSize: 12 * navK }}
                    >
                      {artNode.person.nameNative}
                    </text>
                  )}
                  <text
                    y={labelY + (artNode.person.nameNative ? 26 : 12) * navK}
                    textAnchor="middle"
                    className="label-years"
                    style={{ fontSize: 10 * navK }}
                  >
                    {lifespan(artNode.person)}
                  </text>
                </motion.g>
                {/* Kunstwerk-labels (semantische zoom) */}
                {showArtLabels && (
                  <g
                    className="art-label"
                    opacity={Math.min(1, (view.k - LABEL_ZOOM) / 0.6 + 0.25)}
                  >
                    <text x={artNode.r + 6} y={3} className="label-name">
                      {shortName(artNode.person)}
                    </text>
                    <text x={artNode.r + 6} y={12} className="label-years">
                      {lifespan(artNode.person)}
                    </text>
                  </g>
                )}
              </motion.g>
            </motion.g>
          );
        })}
      </g>
    </svg>
  );
}
