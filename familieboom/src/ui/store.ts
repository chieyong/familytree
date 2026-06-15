import { create } from 'zustand';
import type { PersonID } from '../data/types';
import type { ThemeName } from './theme';

export type ViewMode = 'artwork' | 'navigation';
export type DatasetId = 'demo' | 'habsburg';
export type Backend = 'fixtures' | 'supabase';

const params = new URLSearchParams(window.location.search);

/** Datalaag: fixtures (lokaal) of supabase. URL-param wint van env-default. */
export const BACKEND: Backend =
  params.get('backend') === 'supabase'
    ? 'supabase'
    : params.get('backend') === 'fixtures'
      ? 'fixtures'
      : ((import.meta.env.VITE_BACKEND as Backend) ?? 'fixtures');

/** Geseede familie-UUID's (zie supabase/seed.sql), voor de Supabase-repository. */
export const DATASET_FAMILY_ID: Record<DatasetId, string> = {
  demo: '0a5905fb-54ca-5a29-819b-6017b3600af2',
  habsburg: '83efcaf5-dc36-5d5a-8cae-5366a940d58b',
};

// Startpersoon per dataset; ids verschillen per datalaag (slug vs geseede uuid).
const EGO_FIXTURES: Record<DatasetId, PersonID> = { demo: 'lisa', habsburg: 'Q32500' };
const EGO_SUPABASE: Record<DatasetId, PersonID> = {
  demo: 'eba5edcf-87af-5b3b-874c-9b9f15014772', // Lisa Jansen
  habsburg: '9037837e-337f-5829-8750-1532de2586f2', // Keizer Karel V
};

/** Startpersoon (de "ego") per dataset, afhankelijk van de datalaag. */
export const DATASET_EGO: Record<DatasetId, PersonID> =
  BACKEND === 'supabase' ? EGO_SUPABASE : EGO_FIXTURES;

export interface SessionUser {
  id: string;
  email?: string;
}

/** Een echte (ingelogde) familie die de gebruiker bekijkt, los van de demo-presets. */
export interface ActiveFamily {
  id: string;
  ego: PersonID;
  label: string;
}

interface AppState {
  mode: ViewMode;
  dataset: DatasetId;
  focusId: PersonID;
  /** De "ik": vanuit wiens perspectief relaties benoemd worden. Default: de gebruiker van de dataset. */
  ikId: PersonID;
  theme: ThemeName;
  user: SessionUser | null;
  activeFamily: ActiveFamily | null;
  /** Verhoogt na een mutatie zodat de graaf opnieuw geladen wordt. */
  dataVersion: number;
  setMode: (mode: ViewMode) => void;
  setDataset: (dataset: DatasetId) => void;
  setFocus: (id: PersonID) => void;
  setIk: (id: PersonID) => void;
  toggleTheme: () => void;
  setUser: (user: SessionUser | null) => void;
  setActiveFamily: (family: ActiveFamily | null) => void;
  bumpData: () => void;
}

const initialMode: ViewMode = params.get('view') === 'navigation' ? 'navigation' : 'artwork';
const initialDataset: DatasetId = params.get('data') === 'habsburg' ? 'habsburg' : 'demo';

const THEME_KEY = 'familieboom-theme';

/** Volgorde: URL-param → opgeslagen voorkeur → systeemvoorkeur → donker. */
function initialTheme(): ThemeName {
  const param = params.get('theme');
  if (param === 'light' || param === 'dark') return param;
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
}

const startTheme = initialTheme();
applyTheme(startTheme); // vóór de eerste render, tegen een flits

export const useAppStore = create<AppState>((set) => ({
  mode: initialMode,
  dataset: initialDataset,
  focusId: params.get('focus') ?? DATASET_EGO[initialDataset],
  ikId: params.get('ik') ?? DATASET_EGO[initialDataset],
  theme: startTheme,
  user: null,
  activeFamily: null,
  dataVersion: 0,
  setMode: (mode) => set({ mode }),
  setDataset: (dataset) =>
    set({ dataset, activeFamily: null, focusId: DATASET_EGO[dataset], ikId: DATASET_EGO[dataset] }),
  setFocus: (focusId) => set({ focusId }),
  setIk: (ikId) => set({ ikId }),
  toggleTheme: () =>
    set((state) => {
      const theme: ThemeName = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, theme);
      applyTheme(theme);
      return { theme };
    }),
  setUser: (user) => set({ user }),
  setActiveFamily: (family) =>
    set(family ? { activeFamily: family, focusId: family.ego, ikId: family.ego } : { activeFamily: null }),
  bumpData: () => set((state) => ({ dataVersion: state.dataVersion + 1 })),
}));
