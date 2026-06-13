import { create } from 'zustand';
import type { PersonID } from '../data/types';
import type { ThemeName } from './theme';

export type ViewMode = 'artwork' | 'navigation';
export type DatasetId = 'demo' | 'habsburg';

/** Startpersoon per dataset (de "ego" bij openen). */
export const DATASET_EGO: Record<DatasetId, PersonID> = {
  demo: 'lisa',
  habsburg: 'Q32500', // Keizer Karel V
};

interface AppState {
  mode: ViewMode;
  dataset: DatasetId;
  focusId: PersonID;
  /** De "ik": vanuit wiens perspectief relaties benoemd worden. Default: de gebruiker van de dataset. */
  ikId: PersonID;
  theme: ThemeName;
  setMode: (mode: ViewMode) => void;
  setDataset: (dataset: DatasetId) => void;
  setFocus: (id: PersonID) => void;
  setIk: (id: PersonID) => void;
  toggleTheme: () => void;
}

const params = new URLSearchParams(window.location.search);
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
  setMode: (mode) => set({ mode }),
  setDataset: (dataset) =>
    set({ dataset, focusId: DATASET_EGO[dataset], ikId: DATASET_EGO[dataset] }),
  setFocus: (focusId) => set({ focusId }),
  setIk: (ikId) => set({ ikId }),
  toggleTheme: () =>
    set((state) => {
      const theme: ThemeName = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, theme);
      applyTheme(theme);
      return { theme };
    }),
}));
