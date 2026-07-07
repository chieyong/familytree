import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useReducedMotion } from 'framer-motion';
import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, LineString, MultiLineString, Position } from 'geojson';
import worldTopo from 'world-atlas/countries-50m.json';
import worldTopo110 from 'world-atlas/countries-110m.json';
import type { FamilyGraph, PersonID } from '../data/types';
import { globeData, type GlobeArc, type LifePath } from '../layout/globeLayout';
import { branchColor, PALETTES, shortName, type ThemeName } from './theme';
import { useAppStore, type GlobeLayer } from './store';
import { useT } from './useT';

/** Zoom-bereik (× de auto-fit-basis). Ruim genoeg om op stadsniveau in te zoomen;
 *  de ondergrens wordt per familie verruimd zodat de hele bol altijd bereikbaar is. */
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 60;

/** Landmassa (50m: fijnere kustlijn) + landsgrenzen, één keer uit de topologie. */
const topo = worldTopo as unknown as Topology<{ land: GeometryCollection; countries: GeometryCollection }>;
const land = feature(topo, topo.objects.land) as unknown as FeatureCollection;
const borders = mesh(topo, topo.objects.countries, (a, b) => a !== b) as unknown as MultiLineString;
const graticule = geoGraticule10();

/** Lichtere 110m-landmassa: tijdens het draaien/knijpen tonen we deze i.p.v. de
 *  50m-versie, zodat het herprojecteren per frame veel minder werk is (vloeiend).
 *  In rust schakelen we terug naar 50m voor de scherpe kustlijn. */
const topo110 = worldTopo110 as unknown as Topology<{ land: GeometryCollection }>;
const land110 = feature(topo110, topo110.objects.land) as unknown as FeatureCollection;

interface Props {
  fullGraph: FamilyGraph;
  branches?: Map<PersonID, number>;
  focusId: PersonID;
  theme: ThemeName;
  /** Positie net onder de Boom/Tableau/Atlas-toggle (door App gemeten; rechts-verankerd). */
  layerAnchor?: { top: number; right: number };
  onFocus: (id: PersonID) => void;
  onDeselect?: () => void;
}

const line = (coordinates: Position[]): Feature<LineString> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates },
});

/** Densificeer een boog langs de grootcirkel zodat hij netjes met de bol meebuigt. */
const arcLine = (arc: GlobeArc, steps = 40): Feature<LineString> =>
  line(Array.from({ length: steps + 1 }, (_, i) => geoInterpolate(arc.from, arc.to)(i / steps)));

/** Levenspad: opeenvolgende haltes via grootcirkels aaneenrijgen tot één lijn. */
const lifePathLine = (path: LifePath, steps = 22): Feature<LineString> => {
  const coords: Position[] = [];
  for (let i = 0; i < path.stops.length - 1; i++) {
    const interp = geoInterpolate(path.stops[i].coord, path.stops[i + 1].coord);
    for (let j = i === 0 ? 0 : 1; j <= steps; j++) coords.push(interp(j / steps));
  }
  return line(coords);
};

/**
 * Atlas-view: geboorteplaatsen als stippen op een draaibare orthografische bol,
 * met een schakelbare verhaallaag — migratie (ouder → kind) of levensreis (het
 * volledige pad geboorte → woonplaatsen → overlijden). Draaien met slepen, zoomen
 * met scrollwiel/knoppen; een tik op een stip selecteert de persoon (zelfde kaart
 * als de boom).
 */
export function GlobeCanvas({ fullGraph, branches, focusId, theme, layerAnchor, onFocus, onDeselect }: Props) {
  const t = useT();
  const palette = PALETTES[theme];
  const data = useMemo(() => globeData(fullGraph, branches), [fullGraph, branches]);
  const layer = useAppStore((s) => s.globeLayer);
  const setLayer = useAppStore((s) => s.setGlobeLayer);
  // De bedieningskolom wijkt zolang een topbar-menu open is (valt eroverheen).
  const topbarPop = useAppStore((s) => s.topbarPop);

  // Welke verhaallagen er überhaupt iets te tonen hebben. De gekozen laag valt
  // terug op de gevulde laag als hij zelf leeg is (afgeleid, geen extra state).
  const hasMigration = data.migration.length > 0;
  const hasLife = data.lifePaths.length > 0;
  const activeLayer: GlobeLayer =
    (layer === 'migration' && hasMigration) || (layer === 'life' && hasLife)
      ? layer
      : hasMigration
        ? 'migration'
        : 'life';

  // Personen-filter (Levensreis-laag): toon alleen de gekozen levensreizen, zodat
  // de bol niet dichtslibt met alle paden tegelijk. 'null' = iedereen (geen filter,
  // het standaardbeeld); dit reset vanzelf netjes als de dataset wisselt. Een lege
  // set = niemand. De checklist staat linksboven en is inklapbaar.
  const lifePeople = useMemo(() => {
    const byId = new Map(fullGraph.persons.map((p) => [p.id, p]));
    return data.lifePaths
      .map((lp) => {
        const person = byId.get(lp.personId);
        return { id: lp.personId, name: person ? shortName(person) : t.globe.people, branch: lp.branch };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.lifePaths, fullGraph.persons, t.globe.people]);

  const [selected, setSelected] = useState<Set<PersonID> | null>(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const isSelected = (id: PersonID) => selected === null || selected.has(id);
  const hasFilter = activeLayer === 'life' && selected !== null;

  // Personen-checklist sluit bij een tik/klik buiten het paneel (mobiel én
  // desktop). Pointerdown dekt touch; een tik binnen het paneel (vinkjes,
  // Alles/Geen) laten we met rust.
  const peopleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!peopleOpen) return;
    const onDown = (e: PointerEvent) => {
      if (peopleRef.current && !peopleRef.current.contains(e.target as Node)) {
        setPeopleOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [peopleOpen]);

  const togglePerson = (id: PersonID) =>
    setSelected((prev) => {
      const full = new Set(lifePeople.map((p) => p.id));
      const base = prev === null ? full : new Set(prev);
      if (base.has(id)) base.delete(id);
      else base.add(id);
      return base.size === full.size ? null : base; // alles aangevinkt → terug naar 'iedereen'
    });
  const selectedCount = selected === null ? lifePeople.length : lifePeople.filter((p) => selected.has(p.id)).length;

  // Schermmaat opmeten (zoals FamilyCanvas).
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ cw: 1200, ch: 800 });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width: cw, height: ch } = entry.contentRect;
      if (cw > 0 && ch > 0) setSize({ cw, ch });
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  // Auto-fit: inzoomen tot de dichtste cluster (zie globeLayout) op ~72% van het
  // halve scherm past. De spreidings-vloer van 0.06 rad (≈ 400 km) laat een
  // familie uit één stad op land-niveau starten i.p.v. op een verre wereldbol,
  // en begrenst meteen hoe diep de auto-fit maximaal gaat. Wiel-zoom erbovenop.
  const [zoomK, setZoomK] = useState(1);
  // Actief slepen/knijpen: tijdens beweging tekenen we de lichtere 110m-kaart
  // (en geen landsgrenzen) zodat het herprojecteren per frame vloeiend blijft.
  const [interacting, setInteracting] = useState(false);
  const { cw, ch } = size;
  const minHalf = Math.min(cw, ch) / 2;
  const base = useMemo(() => {
    if (data.points.length === 0) return minHalf * 0.92;
    const eff = Math.max(Math.min(data.spread, Math.PI / 2), 0.06);
    return (minHalf * 0.72) / Math.sin(eff);
  }, [minHalf, data.spread, data.points.length]);
  const scale = base * zoomK;

  // Uitzoomen mag altijd tot de hele bol, ook als de basis diep op een land inzoomt.
  const minK = Math.min(ZOOM_MIN, (minHalf * 0.92) / base);
  const clampZoom = useCallback(
    (k: number) => Math.max(minK, Math.min(ZOOM_MAX, k)),
    [minK],
  );

  // Oriëntatie van de bol: [lambda, phi]. Start op het zwaartepunt van de familie;
  // bij beweging glijdt de bol er bij mount vanaf een schuine hoek naartoe.
  const reducedMotion = useReducedMotion();
  const orient = (c: [number, number]): [number, number] => [-c[0], -c[1]];
  const [rotation, setRotation] = useState<[number, number]>(() => {
    const target = orient(data.center);
    return reducedMotion ? target : [target[0] - 65, Math.max(-60, Math.min(60, target[1] - 12))];
  });

  // Vlieg de bol vanaf een schuine hoek naar een zwaartepunt toe (easeOutCubic),
  // langs requestAnimationFrame. Bij reduced-motion zetten we 'm direct neer.
  const introRef = useRef<number>(0);
  const animateTo = useCallback(
    (center: [number, number]) => {
      cancelAnimationFrame(introRef.current);
      const target: [number, number] = [-center[0], -center[1]];
      if (reducedMotion) {
        setRotation(target);
        return;
      }
      const start: [number, number] = [target[0] - 65, Math.max(-60, Math.min(60, target[1] - 12))];
      const t0 = performance.now();
      const dur = 1300;
      const tick = (now: number) => {
        const u = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - u, 3); // easeOutCubic
        setRotation([start[0] + (target[0] - start[0]) * e, start[1] + (target[1] - start[1]) * e]);
        if (u < 1) introRef.current = requestAnimationFrame(tick);
      };
      introRef.current = requestAnimationFrame(tick);
    },
    [reducedMotion],
  );

  // Intro-fly-in: éénmalig bij mount. animateTo neemt hier (zonder reduced-motion)
  // het requestAnimationFrame-pad; de setState zit dus in de frame-callback.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!reducedMotion) animateTo(data.center);
    return () => cancelAnimationFrame(introRef.current);
    // Alleen bij mount; de recenter hieronder vangt latere dataset-wissels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter bij een nieuwe dataset/familie. De graaf laadt async, dus de eerste
  // mount kan nog de oude data tonen; verspringt het zwaartepunt daarna fors, dan
  // vliegen we naar de nieuwe locatie i.p.v. op een willekeurig stuk wereld te
  // blijven hangen. Kleine verschuivingen (bv. na een mutatie) laten de handmatige
  // stand met rust. data.center is alleen een nieuwe referentie als de graaf wijzigt.
  const lastCenterRef = useRef(data.center);
  useEffect(() => {
    if (lastCenterRef.current === data.center) return;
    const prev = lastCenterRef.current;
    lastCenterRef.current = data.center;
    if (geoDistance(prev, data.center) < 0.05) return;
    setZoomK(1); // nieuwe familie: terug naar de auto-fit-basiszoom
    animateTo(data.center);
  }, [data.center, animateTo]);

  // Wiel-zoom (niet-passief, zodat we de pagina niet laten scrollen).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoomK((k) => clampZoom(k * Math.exp(-e.deltaY * 0.0012)));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [clampZoom]);

  const projection = useMemo(
    () => geoOrthographic().translate([cw / 2, ch / 2]).scale(scale).rotate(rotation).clipAngle(90),
    [cw, ch, scale, rotation],
  );
  const path = useMemo(() => geoPath(projection), [projection]);

  // Wat naar de kijker is gericht (orthografisch projecteert ook de achterkant,
  // dus stippen zelf cullen we handmatig op hoekafstand tot het bolmidden).
  const centerGeo: [number, number] = [-rotation[0], -rotation[1]];
  const isFront = ([lon, lat]: [number, number]): boolean => {
    const dλ = ((lon - centerGeo[0]) * Math.PI) / 180;
    const φ1 = (centerGeo[1] * Math.PI) / 180;
    const φ2 = (lat * Math.PI) / 180;
    const cosC = Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(dλ);
    return cosC >= -0.02;
  };

  // Lijnen van de actieve laag: migratiebogen (ouder→kind) of levenspaden
  // (geboorte → woonplaatsen → overlijden). 'focus' accentueert de selectie.
  const arcFeatures = useMemo(() => {
    if (activeLayer === 'migration') {
      return data.migration.map((a) => ({
        key: a.id,
        feature: arcLine(a),
        branch: a.branch,
        focus: a.sourceId === focusId || a.targetId === focusId,
      }));
    }
    return data.lifePaths
      .filter((p) => isSelected(p.personId))
      .map((p) => ({
        key: p.id,
        feature: lifePathLine(p),
        branch: p.branch,
        focus: p.personId === focusId,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayer, data.migration, data.lifePaths, focusId, selected]);

  // Tussenstops (woonplaatsen) en eindpunten (sterfteplaats ✕) van de levenspaden.
  const residenceStops = useMemo(
    () =>
      activeLayer === 'life'
        ? data.lifePaths
            .filter((p) => isSelected(p.personId))
            .flatMap((p) =>
              p.stops
                .filter((s) => s.kind === 'residence')
                .map((s, i) => ({ key: `${p.id}-r${i}`, coord: s.coord, branch: p.branch, focus: p.personId === focusId })),
            )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeLayer, data.lifePaths, focusId, selected],
  );
  const deathStops = useMemo(
    () =>
      activeLayer === 'life'
        ? data.lifePaths
            .filter((p) => isSelected(p.personId))
            .map((p) => {
              const last = p.stops[p.stops.length - 1];
              return last.kind === 'death'
                ? { key: p.id, coord: last.coord, branch: p.branch, focus: p.personId === focusId }
                : null;
            })
            .filter((d): d is NonNullable<typeof d> => d !== null)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeLayer, data.lifePaths, focusId, selected],
  );

  // Selectie: dichtstbijzijnde zichtbare stip onder de tik (drempel in pixels).
  const hitTest = (px: number, py: number): PersonID | null => {
    let best: PersonID | null = null;
    let bestDist = 26;
    for (const point of data.points) {
      if (!isFront(point.coord)) continue;
      const xy = projection(point.coord);
      if (!xy) continue;
      const dist = Math.hypot(px - xy[0], py - xy[1]);
      if (dist < bestDist) {
        bestDist = dist;
        best = point.id;
      }
    }
    return best;
  };

  // Eén vinger sleept (draaien), twee vingers knijpen (zoomen); een korte tik
  // zonder verschuiving selecteert. Pointer-events dekken muis én touch.
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const rotateRef = useRef<{ x: number; y: number; rot: [number, number] } | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const movedRef = useRef(false);
  const twoFingerDist = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    cancelAnimationFrame(introRef.current);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setInteracting(true);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      rotateRef.current = { x: e.clientX, y: e.clientY, rot: rotation };
      pinchRef.current = null;
      movedRef.current = false;
    } else if (pointers.current.size === 2) {
      pinchRef.current = { dist: twoFingerDist(), zoom: zoomK };
      rotateRef.current = null;
      movedRef.current = true; // knijpen telt niet als tik
    }
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2 && pinchRef.current) {
      const ratio = twoFingerDist() / pinchRef.current.dist;
      setZoomK(clampZoom(pinchRef.current.zoom * ratio));
      return;
    }
    const d = rotateRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) movedRef.current = true;
    // Graden per pixel ≈ (180/π)/scale: een punt onder de vinger blijft eronder,
    // dus ingezoomd (grote scale) draait de bol vanzelf rustiger.
    const k = (180 / Math.PI) / scale;
    const phi = Math.max(-89, Math.min(89, d.rot[1] - dy * k));
    setRotation([d.rot[0] + dx * k, phi]);
  };
  const endPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    if (pointers.current.size === 1) {
      // Van knijpen terug naar één vinger: herijk de sleep-basis (geen sprong).
      const [only] = [...pointers.current.values()];
      rotateRef.current = { x: only.x, y: only.y, rot: rotation };
      pinchRef.current = null;
      return;
    }
    if (pointers.current.size === 0) {
      setInteracting(false); // terug naar de scherpe 50m-kaart
      const wasRotate = rotateRef.current;
      rotateRef.current = null;
      pinchRef.current = null;
      if (!movedRef.current && wasRotate) {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
        if (hit) onFocus(hit);
        else onDeselect?.();
      }
    }
  };

  const sphere: GeoPermissibleObjects = { type: 'Sphere' };
  const empty = data.points.length === 0;

  // Statische lagen (bol, raster, land, grenzen) maar één keer per projectie
  // omzetten naar SVG-paden, i.p.v. bij elke render (zoals een vinkje in de
  // personen-lijst of een focuswissel). Tijdens slepen/knijpen de lichtere
  // 110m-landmassa en geen landsgrenzen — dat scheelt veel rekenwerk per frame.
  const basePaths = useMemo(
    () => ({
      sphere: path(sphere) ?? undefined,
      graticule: path(graticule as unknown as GeoPermissibleObjects) ?? undefined,
      land: path(interacting ? land110 : land) ?? undefined,
      borders: interacting ? undefined : (path(borders as unknown as GeoPermissibleObjects) ?? undefined),
    }),
    // 'sphere' is een constante literal; alleen de projectie (path) en interacting tellen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, interacting],
  );

  return (
    <div className="globe-wrap">
      {/* Bedieningskolom rechtsboven: verhaallaag-toggle met daaronder de
          personen-checklist. Eén kolom onder de view-toggle, zodat er niets
          met de topbar botst (mobiel) en de bediening op één plek zit. */}
      {!empty && !topbarPop && (hasMigration || hasLife) && (
        <div
          className="globe-controls"
          style={layerAnchor ? { top: layerAnchor.top, right: layerAnchor.right } : undefined}
        >
          <div className="globe-layers" role="group" aria-label={t.globe.layerLabel}>
            <button
              className={activeLayer === 'migration' ? 'active' : ''}
              disabled={!hasMigration}
              onClick={() => setLayer('migration')}
            >
              {t.globe.migration}
            </button>
            <button
              className={activeLayer === 'life' ? 'active' : ''}
              disabled={!hasLife}
              onClick={() => setLayer('life')}
            >
              {t.globe.life}
            </button>
          </div>

          {activeLayer === 'life' && lifePeople.length > 1 && (
            <div ref={peopleRef} className={`globe-people${peopleOpen ? ' open' : ''}`}>
              <button
                className="globe-people-toggle"
                aria-expanded={peopleOpen}
                onClick={() => setPeopleOpen((o) => !o)}
              >
                <span>{t.globe.people}</span>
                <span className="globe-people-count">{selectedCount}/{lifePeople.length}</span>
              </button>
              {peopleOpen && (
                <div className="globe-people-body" role="group" aria-label={t.globe.peopleLabel}>
                  <div className="globe-people-actions">
                    <button onClick={() => setSelected(null)}>{t.globe.all}</button>
                    <button onClick={() => setSelected(new Set())}>{t.globe.none}</button>
                  </div>
                  <ul className="globe-people-list">
                    {lifePeople.map((p) => (
                      <li key={p.id}>
                        <label>
                          <input type="checkbox" checked={isSelected(p.id)} onChange={() => togglePerson(p.id)} />
                          <span className="globe-people-swatch" style={{ background: branchColor(p.branch, theme) }} />
                          <span className="globe-people-name">{p.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <svg
        ref={svgRef}
        className="viz globe-viz"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <defs>
          <radialGradient id="globe-shade" cx="0.38" cy="0.34" r="0.75">
            <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.28)" />
          </radialGradient>
        </defs>

        <path d={basePaths.sphere} fill={palette.globeOcean} stroke="none" />
        <path d={basePaths.graticule} fill="none" stroke={palette.globeGraticule} strokeWidth={0.5} />
        <path d={basePaths.land} fill={palette.globeLand} stroke="none" opacity={0.92} />
        {basePaths.borders && (
          <path d={basePaths.borders} fill="none" stroke={palette.globeOcean} strokeWidth={0.4} opacity={0.55} />
        )}

        {/* Verhaallaag: lijnen (migratiebogen of levenspaden) */}
        <g style={{ pointerEvents: 'none' }}>
          {arcFeatures.map(({ key, feature, branch, focus }) => {
            const d = path(feature);
            if (!d) return null;
            return (
              <path
                key={key}
                d={d}
                fill="none"
                stroke={branchColor(branch, theme)}
                strokeWidth={focus ? 2.2 : 1.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={(focus ? 0.95 : 0.5) * palette.lineBoost}
              />
            );
          })}
        </g>

        {/* Woonplaatsen — kleine tussenstops op het levenspad */}
        <g style={{ pointerEvents: 'none' }}>
          {residenceStops.map(({ key, coord, branch, focus }) => {
            if (!isFront(coord)) return null;
            const xy = projection(coord);
            if (!xy) return null;
            const color = branchColor(branch, theme);
            return (
              <circle
                key={key}
                cx={xy[0]}
                cy={xy[1]}
                r={focus ? 3.4 : 2.6}
                fill={color}
                stroke={palette.globeOcean}
                strokeWidth={0.8}
                opacity={0.95}
              />
            );
          })}
        </g>

        {/* Sterfteplaatsen (✕) — eindpunt van het levenspad */}
        <g style={{ pointerEvents: 'none' }}>
          {deathStops.map(({ key, coord, branch, focus }) => {
            if (!isFront(coord)) return null;
            const xy = projection(coord);
            if (!xy) return null;
            const s = 4.5;
            return (
              <g key={key} transform={`translate(${xy[0]}, ${xy[1]})`} stroke={branchColor(branch, theme)} strokeWidth={focus ? 2 : 1.4} strokeLinecap="round" opacity={0.95}>
                <line x1={-s} y1={-s} x2={s} y2={s} />
                <line x1={-s} y1={s} x2={s} y2={-s} />
              </g>
            );
          })}
        </g>

        {/* Geboorteplaatsen — in de levensreis-laag altijd gevuld (helder startpunt) */}
        <g style={{ pointerEvents: 'none' }}>
          {data.points.map((point) => {
            if (!isFront(point.coord)) return null;
            const xy = projection(point.coord);
            if (!xy) return null;
            const color = branchColor(point.branch, theme);
            const isFocus = point.id === focusId;
            const r = isFocus ? 6 : 4;
            const hollow = activeLayer === 'migration' && point.deceased;
            // In de levensreis-laag dimt een niet-gekozen persoon zodat de
            // geselecteerde paden eruit springen; hij blijft wel aantikbaar.
            const dimmed = hasFilter && !isSelected(point.id);
            return (
              <g key={point.id} transform={`translate(${xy[0]}, ${xy[1]})`} opacity={dimmed ? 0.28 : 1}>
                {isFocus && (
                  <circle r={r + 4} fill="none" stroke={palette.focusRing} strokeWidth={1.4} opacity={0.9} />
                )}
                <circle
                  r={r}
                  fill={hollow ? palette.globeOcean : color}
                  stroke={color}
                  strokeWidth={hollow ? 1.6 : 0}
                  opacity={0.96}
                />
              </g>
            );
          })}
        </g>

        {/* Subtiele bolschaduw bovenop */}
        <path d={basePaths.sphere} fill="url(#globe-shade)" stroke="none" style={{ pointerEvents: 'none' }} />
      </svg>

      {!empty && (
        <div className="globe-zoom">
          <button aria-label={t.globe.zoomIn} onClick={() => setZoomK((k) => clampZoom(k * 1.4))}>+</button>
          <button aria-label={t.globe.zoomOut} onClick={() => setZoomK((k) => clampZoom(k / 1.4))}>−</button>
        </div>
      )}

      {empty && <div className="globe-empty">{t.globe.empty}</div>}
    </div>
  );
}
