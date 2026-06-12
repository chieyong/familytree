import { create } from 'zustand';
import type { PersonID } from '../data/types';

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
  setMode: (mode: ViewMode) => void;
  setDataset: (dataset: DatasetId) => void;
  setFocus: (id: PersonID) => void;
  setIk: (id: PersonID) => void;
}

const params = new URLSearchParams(window.location.search);
const initialMode: ViewMode = params.get('view') === 'navigation' ? 'navigation' : 'artwork';
const initialDataset: DatasetId = params.get('data') === 'habsburg' ? 'habsburg' : 'demo';

export const useAppStore = create<AppState>((set) => ({
  mode: initialMode,
  dataset: initialDataset,
  focusId: params.get('focus') ?? DATASET_EGO[initialDataset],
  ikId: params.get('ik') ?? DATASET_EGO[initialDataset],
  setMode: (mode) => set({ mode }),
  setDataset: (dataset) =>
    set({ dataset, focusId: DATASET_EGO[dataset], ikId: DATASET_EGO[dataset] }),
  setFocus: (focusId) => set({ focusId }),
  setIk: (ikId) => set({ ikId }),
}));
