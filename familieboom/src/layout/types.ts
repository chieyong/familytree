import type { ParentRole, Person, UnionType } from '../data/types';

export interface LayoutNode {
  person: Person;
  x: number;
  y: number;
  r: number;
  generation: number;
  branch: number;
  deceased: boolean;
  isEgo?: boolean;
  /** 0 of 1: label-hoogte alterneert in drukke rijen tegen tekstoverlap. */
  labelTier?: number;
}

export interface LayoutLink {
  id: string;
  kind: 'parent' | 'union';
  /** Alleen bij kind 'parent'. */
  role?: ParentRole;
  /** Alleen bij kind 'union'. */
  unionType?: UnionType;
  ended?: boolean;
  path: string;
  sourceId: string;
  targetId: string;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  links: LayoutLink[];
  /** Bounding box als [minX, minY, breedte, hoogte] voor viewBox/camera. */
  bounds: [number, number, number, number];
}
