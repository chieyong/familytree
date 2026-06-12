import type { Person } from '../data/types';
import type { LayoutLink } from '../layout/types';

/** Tak-palet: warm editoriaal, leesbaar op donker. Kleur = stamtak (data-encoding). */
export const BRANCH_COLORS = ['#E0A458', '#5FB7A5', '#C9705D', '#8D7BD4', '#7A9E7E', '#B5838D'];

export const branchColor = (branch: number): string =>
  BRANCH_COLORS[branch % BRANCH_COLORS.length];

export interface LinkStyle {
  stroke: string;
  strokeWidth: number;
  dash?: string;
  opacity: number;
}

/** Eén bron van waarheid voor relatie-encoding, gedeeld door beide views. */
export function linkStyle(link: LayoutLink, color: string): LinkStyle {
  if (link.kind === 'union') {
    if (link.ended) {
      return { stroke: '#A89E8C', strokeWidth: 1.4, dash: '6 5', opacity: 0.4 };
    }
    const informal = link.unionType === 'cohabitation' || link.unionType === 'relationship';
    return { stroke: '#E9E2D0', strokeWidth: informal ? 1.6 : 2.4, dash: informal ? '2 4' : undefined, opacity: 0.75 };
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
  const name = person.displayName ?? `${person.givenNames[0]} ${person.familyName ?? ''}`.trim();
  // Wikidata-items zonder label leveren een ruwe QID op — toon die niet.
  return /^Q\d+$/.test(name) ? 'Naam onbekend' : name;
}

export function lifespan(person: Person): string {
  const birth = person.birth?.date?.year;
  const death = person.death?.date?.year;
  if (birth && death) return `${birth}–${death}`;
  if (birth) return `${birth}`;
  return '';
}
