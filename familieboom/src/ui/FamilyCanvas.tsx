import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import type { FamilyGraph, Person, PersonID } from '../data/types';
import { flowLayout } from '../layout/flowLayout';
import { egoLayout } from '../layout/egoLayout';
import { affinePath } from '../layout/transform';
import type { LayoutLink, LayoutNode } from '../layout/types';
import type { ViewMode } from './store';
import { branchColor, lifespan, linkStyle, shortName } from './theme';

interface Props {
  mode: ViewMode;
  fullGraph: FamilyGraph;
  egoGraph?: FamilyGraph;
  focusId: PersonID;
  branches?: Map<PersonID, number>;
  onFocus: (id: PersonID) => void;
}

const LABEL_ZOOM = 1.5;
const NAV_BASE = 940; // referentiemaat van de oude navigatie-camera
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
export function FamilyCanvas({ mode, fullGraph, egoGraph, focusId, branches, onFocus }: Props) {
  const art = useMemo(() => flowLayout(fullGraph), [fullGraph]);
  const [minX, minY, width, height] = art.bounds;

  // Navigatie-layout, geprojecteerd in de canvas-ruimte van het kunstwerk.
  const nav = useMemo(() => {
    if (!egoGraph) return undefined;
    const raw = egoLayout(egoGraph, focusId, branches);
    const [nx, ny, nw, nh] = raw.bounds;
    const unit = Math.min(width, height) / NAV_BASE;
    const k = Math.min(Math.max(Math.min(width / nw, height / nh) * 0.92, 0.58 * unit), 1.15 * unit);
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
  }, [egoGraph, focusId, branches, width, height, minX, minY]);

  const isNav = mode === 'navigation' && nav !== undefined;

  // Camera: pan/zoom in beide modi; reset bij mode- of focuswissel.
  const svgRef = useRef<SVGSVGElement>(null);
  const behaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>(null);
  const [view, setView] = useState<ZoomTransform>(zoomIdentity);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 9])
      .on('zoom', (event) => setView(event.transform));
    behaviorRef.current = behavior;
    select(svg).call(behavior);
    return () => {
      select(svg).on('.zoom', null);
    };
  }, []);
  useEffect(() => {
    const svg = svgRef.current;
    const behavior = behaviorRef.current;
    if (svg && behavior) select(svg).call(behavior.transform, zoomIdentity);
  }, [mode, focusId]);

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

  return (
    <svg ref={svgRef} className="viz" viewBox={`${minX} ${minY} ${width} ${height}`}>
      <defs>
        <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g transform={view.toString()}>
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
                stroke="#ece6d8"
                strokeWidth={thin(0.5)}
                opacity={0.07}
              />
              <text x={minX + 14} y={decade.y - 4} className="decade-label">
                {decade.year}
              </text>
            </motion.g>
          ))}
          {art.lifelines.map((line) => {
            const baseOpacity = line.living ? 0.26 : 0.42;
            const isHero = intro && line.id === heroId;
            return (
              <motion.path
                key={line.id}
                d={line.path}
                fill="none"
                stroke={branchColor(line.branch)}
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
          const color = branchColor(sourceNode?.branch ?? 0);
          const navLink = nav?.links.get(link.id);
          const style = linkStyle(link, color);
          let opacity = style.opacity;
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
            opacity = touchesEgo ? Math.min(1, style.opacity + 0.25) : style.opacity * 0.35;
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
          const color = branchColor(artNode.branch);
          const deceased = isDeceasedStyle(artNode.person);
          const isFocus = id === focusId;
          const navK = nav?.k ?? 1;
          const labelY = active.r + (16 + (navNode?.labelTier ? 26 : 0)) * navK;
          return (
            <motion.g
              key={id}
              initial={false}
              animate={{
                x: active.x,
                y: active.y,
                opacity: hidden ? 0 : 1,
              }}
              transition={spring}
              className="art-node"
              style={{ pointerEvents: hidden ? 'none' : undefined }}
              onClick={() => onFocus(id)}
            >
              <motion.g
                {...(intro && !isNav
                  ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: introDelayFor(id), duration: 0.8 } }
                  : {})}
              >
                {isFocus && (
                  <motion.circle
                    animate={{ r: active.r + 7 }}
                    transition={spring}
                    fill="none"
                    stroke="#E9E2D0"
                    strokeWidth={1.2}
                    opacity={0.85}
                  />
                )}
                <motion.circle
                  animate={{ r: active.r }}
                  transition={spring}
                  fill={deceased ? '#0b101f' : color}
                  stroke={color}
                  strokeWidth={deceased ? 1.6 : 0}
                  opacity={0.95}
                  filter="url(#glow)"
                />
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
                    fill={deceased ? color : 'rgba(11, 16, 31, 0.85)'}
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
                  <text
                    y={labelY + 12 * navK}
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
