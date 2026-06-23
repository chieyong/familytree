import type { Person } from '../data/types';
import type { LayoutLink } from '../layout/types';

export type ThemeName = 'dark' | 'light';

/**
 * Tak-palet (kleur = stamtak, data-encoding). Het lichte palet is donkerder en
 * verzadigder zodat lijnen ook bij lage opacity leesbaar blijven op papier.
 */
const BRANCH_COLORS_DARK = ['#E0A458', '#5FB7A5', '#C9705D', '#8D7BD4', '#7A9E7E', '#B5838D'];
const BRANCH_COLORS_LIGHT = ['#C8801E', '#3E9485', '#B5503C', '#6B57B8', '#5C8060', '#9D5F6B'];

export const branchColors = (theme: ThemeName): string[] =>
  theme === 'light' ? BRANCH_COLORS_LIGHT : BRANCH_COLORS_DARK;

export const branchColor = (branch: number, theme: ThemeName = 'dark'): string => {
  const colors = branchColors(theme);
  return colors[branch % colors.length];
};

/** Thema-afhankelijke kleuren die niet uit het tak-palet komen (voor de SVG). */
export interface Palette {
  axis: string;
  focusRing: string;
  deceasedFill: string;
  unionStroke: string;
  unionEndedStroke: string;
  nodeText: string;
  /** Opacity-versterking voor lijnen op papier (donker = 1). */
  lineBoost: number;
}

export const PALETTES: Record<ThemeName, Palette> = {
  dark: {
    axis: '#ece6d8',
    focusRing: '#E9E2D0',
    deceasedFill: '#0b101f',
    unionStroke: '#E9E2D0',
    unionEndedStroke: '#A89E8C',
    nodeText: 'rgba(11, 16, 31, 0.85)',
    lineBoost: 1,
  },
  light: {
    axis: '#3a352c',
    focusRing: '#2a2620',
    deceasedFill: '#efe9db',
    unionStroke: '#5c5446',
    unionEndedStroke: '#9a917e',
    nodeText: 'rgba(250, 247, 239, 0.92)',
    lineBoost: 1.2,
  },
};

export interface LinkStyle {
  stroke: string;
  strokeWidth: number;
  dash?: string;
  opacity: number;
}

/** Eén bron van waarheid voor relatie-encoding, gedeeld door beide views. */
export function linkStyle(link: LayoutLink, color: string, palette: Palette): LinkStyle {
  if (link.kind === 'union') {
    if (link.ended) {
      return { stroke: palette.unionEndedStroke, strokeWidth: 1.4, dash: '6 5', opacity: 0.4 };
    }
    const informal = link.unionType === 'cohabitation' || link.unionType === 'relationship';
    return {
      stroke: palette.unionStroke,
      strokeWidth: informal ? 1.6 : 2.4,
      dash: informal ? '2 4' : undefined,
      opacity: 0.75,
    };
  }
  switch (link.role) {
    case 'adoptive':
      return { stroke: color, strokeWidth: 1.6, dash: '1 5', opacity: 0.85 };
    case 'step':
    case 'foster':
      return { stroke: color, strokeWidth: 1.3, dash: '7 5', opacity: 0.5 };
    default:
      return { stroke: color, strokeWidth: 1.6, opacity: 0.55 };
  }
}

export function shortName(person: Person): string {
  // Roepnaam wint als hij gezet is; anders de eerste voornaam (of een import-
  // displayName, zoals bij Wikidata-data).
  const main = person.callName?.trim()
    ? `${person.callName.trim()} ${person.familyName ?? ''}`.trim()
    : (person.displayName ?? `${person.givenNames[0]} ${person.familyName ?? ''}`.trim());
  const full = main;
  // Voorkeursnaam als hoofd-label; valt terug op de volledige naam als leeg.
  let name = full;
  if (person.preferredName === 'native' && person.nameNative) name = person.nameNative;
  else if (person.preferredName === 'nickname' && person.nickname) name = person.nickname;
  // Wikidata-items zonder label leveren een ruwe QID op — toon die niet.
  return /^Q\d+$/.test(name) ? 'Naam onbekend' : name;
}

/**
 * De naam in eigen schrift om als tweede regel te tonen — maar niet wanneer die
 * al de hoofdnaam is (zou dan dubbel staan).
 */
export function nativeSubline(person: Person): string | undefined {
  if (!person.nameNative || person.preferredName === 'native') return undefined;
  return person.nameNative;
}

export function lifespan(person: Person): string {
  const birth = person.birth?.date?.year;
  const death = person.death?.date?.year;
  if (birth && death) return `${birth}–${death}`;
  if (birth) return `${birth}`;
  return '';
}
