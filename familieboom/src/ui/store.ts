import { create } from 'zustand';
import type { PersonID, ViewAs } from '../data/types';
import type { ThemeName } from './theme';
import type { Lang } from './i18n';

export type ViewMode = 'artwork' | 'navigation' | 'globe';
/** Verhaallaag in de Atlas-view: migratie (ouder→kind) of levensreis (geboorte→sterfte). */
export type GlobeLayer = 'migration' | 'life';
/** Bereik van de Boom-view: de ego-kring (BFS-diepte) of de totale familie,
 *  alle generaties helemaal uitgeklapt. */
export type TreeScope = 'circle' | 'all';
/** Welke topbar-dropdown open staat (max één tegelijk); de zwevende
 *  bereik-/laagtoggles wijken zolang er een menu open is. */
export type TopbarPop = 'more' | 'viewAs' | 'account' | null;
export type DatasetId = 'demo' | 'diaspora' | 'habsburg';
export type Backend = 'fixtures' | 'supabase' | 'local';

const params = new URLSearchParams(window.location.search);

/** Draait de app binnen de Tauri-desktopschil? Dan is de datalaag altijd lokaal
 *  (geen cloud, geen netwerk). Dezelfde frontend-build werkt zo als web-app in de
 *  browser én als offline desktop-app. `?backend=local` laat je de lokale modus
 *  ook in de browser testen. */
const IS_TAURI = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;

/** Datalaag: fixtures (lokaal-demo), supabase (cloud) of local (desktop, offline).
 *  Tauri → altijd local; anders wint de URL-param van de env-default. */
export const BACKEND: Backend =
  IS_TAURI || params.get('backend') === 'local' || import.meta.env.VITE_BACKEND === 'local'
    ? 'local'
    : params.get('backend') === 'supabase'
      ? 'supabase'
      : params.get('backend') === 'fixtures'
        ? 'fixtures'
        : ((import.meta.env.VITE_BACKEND as Backend) ?? 'fixtures');

/** Geseede familie-UUID's (zie supabase/seed.sql), voor de Supabase-repository.
 *  'diaspora' is een fixtures-only demo (niet geseed) → placeholder-UUID. */
export const DATASET_FAMILY_ID: Record<DatasetId, string> = {
  demo: '0a5905fb-54ca-5a29-819b-6017b3600af2',
  diaspora: '00000000-0000-5000-8000-000000000d1a',
  habsburg: '83efcaf5-dc36-5d5a-8cae-5366a940d58b',
};

/** Demo's die alleen als fixture bestaan (niet in Supabase geseed) → altijd lokaal
 *  laden, ook met de supabase-backend, anders zien ze er leeg uit. */
export const FIXTURES_ONLY_DATASETS: DatasetId[] = ['diaspora'];

// Startpersoon per dataset; ids verschillen per datalaag (slug vs geseede uuid).
const EGO_FIXTURES: Record<DatasetId, PersonID> = { demo: 'lisa', diaspora: 'eric', habsburg: 'Q32500' };
const EGO_SUPABASE: Record<DatasetId, PersonID> = {
  demo: 'eba5edcf-87af-5b3b-874c-9b9f15014772', // Lisa Jansen
  diaspora: 'eric', // fixtures-only; bij supabase valt de app terug op de eerste persoon
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
/** In-app dialoog-verzoek (bevestigen of tekstinvoer). resolve krijgt de ingevoerde
 *  string bij OK, of null bij annuleren. */
export interface DialogRequest {
  kind: 'confirm' | 'prompt';
  message: string;
  defaultValue?: string;
  resolve: (value: string | null) => void;
}

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
  /** Interfacetaal. */
  lang: Lang;
  /** Actieve verhaallaag in de Atlas-view. */
  globeLayer: GlobeLayer;
  /** Bereik van de Boom-view (kring of 3/5/7 generaties). */
  treeScope: TreeScope;
  /** Open topbar-dropdown (instellingen, Bekijk-als, account); null = geen. */
  topbarPop: TopbarPop;
  /** Profielfoto's in de boom tonen (focus + inzoomen). De detailkaart toont altijd. */
  photos: boolean;
  user: SessionUser | null;
  activeFamily: ActiveFamily | null;
  /** Actieve "Bekijk als …"-simulatie (owner-tool); null = normale weergave. */
  viewAs: ViewAs | null;
  /** Familie waar je vandaan kwam bij het oversteken van een brug (kruimelpad). */
  bridgeReturn: ActiveFamily | null;
  /**
   * Extra gekoppelde families die tegelijk met de actieve boom getoond worden:
   * hun grafen worden op de brugpersonen aan elkaar genaaid tot één boom. Leeg
   * = alleen de actieve familie. Wordt gewist bij familie-wissel.
   */
  linkedFamilyIds: string[];
  /** Login-modal open (gedeeld, zodat o.a. een uitnodiging 'm kan openen). */
  authOpen: boolean;
  /** Uitleg-gids open (gedeeld, zodat de welkomstkaart 'm kan openen). */
  guideOpen: boolean;
  /** "Over de maker"-paneel open (gedeeld; menu, legenda en welkom openen 'm). */
  aboutOpen: boolean;
  /** Coachmark-rondleiding actief. */
  tourOpen: boolean;
  /** Vluchtige melding (bv. 'uitgelogd'); App toont 'm als banner. */
  notice?: string;
  /** Actieve in-app dialoog (bevestigen/invoer). Vervangt window.confirm/prompt —
   *  die werken niet in de Tauri-webview. Null = geen dialoog. */
  dialog: DialogRequest | null;
  setDialog: (dialog: DialogRequest | null) => void;
  /** Verhoogt na een mutatie zodat de graaf opnieuw geladen wordt. */
  dataVersion: number;
  setMode: (mode: ViewMode) => void;
  setLang: (lang: Lang) => void;
  setGlobeLayer: (layer: GlobeLayer) => void;
  setTreeScope: (scope: TreeScope) => void;
  setTopbarPop: (pop: TopbarPop) => void;
  setDataset: (dataset: DatasetId) => void;
  setFocus: (id: PersonID) => void;
  setIk: (id: PersonID) => void;
  toggleTheme: () => void;
  togglePhotos: () => void;
  setUser: (user: SessionUser | null) => void;
  setActiveFamily: (family: ActiveFamily | null) => void;
  /** Zet of wis de "Bekijk als …"-simulatie. */
  setViewAs: (viewAs: ViewAs | null) => void;
  /** Steek over naar een gekoppelde familie en onthoud waar je vandaan kwam. */
  crossTo: (family: ActiveFamily) => void;
  /** Keer terug naar de familie van vóór het oversteken. */
  crossBack: () => void;
  /** Zet een gekoppelde familie aan/uit in de samengevoegde weergave. */
  toggleLinkedFamily: (familyId: string) => void;
  setAuthOpen: (open: boolean) => void;
  setGuideOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  setTourOpen: (open: boolean) => void;
  setNotice: (notice?: string) => void;
  bumpData: () => void;
}

const viewParam = params.get('view');
const initialMode: ViewMode =
  viewParam === 'artwork' ? 'artwork' : viewParam === 'globe' ? 'globe' : 'navigation';
// Default-demo is de internationale familie (toont de Atlas op z'n best); de oude
// 'demo' blijft bestaan en is bereikbaar via ?data=demo, maar niet meer de default.
const dataParam = params.get('data');
// Lokale (desktop) modus heeft geen presets — de placeholder-repo geeft de demo
// terug, dus mik op 'demo' (ego 'lisa' bestaat daar; anders is de Boom-view leeg).
const initialDataset: DatasetId =
  BACKEND === 'local'
    ? 'demo'
    : dataParam === 'habsburg' ? 'habsburg' : dataParam === 'demo' ? 'demo' : 'diaspora';

const THEME_KEY = 'familieboom-theme';
const PHOTOS_KEY = 'familieboom-photos';
const LANG_KEY = 'familieboom-lang';
export const LAST_FAMILY_KEY = 'familieboom-last-family';

/** Volgorde: URL-param → opgeslagen voorkeur → browsertaal → Nederlands. */
function initialLang(): Lang {
  const supported: Lang[] = ['nl', 'en', 'zh', 'id'];
  const param = params.get('lang');
  if (param && supported.includes(param as Lang)) return param as Lang;
  const saved = localStorage.getItem(LANG_KEY);
  if (saved && supported.includes(saved as Lang)) return saved as Lang;
  const browser = navigator.language?.slice(0, 2).toLowerCase();
  return supported.includes(browser as Lang) ? (browser as Lang) : 'nl';
}

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
  lang: initialLang(),
  globeLayer: params.get('layer') === 'life' ? 'life' : 'migration',
  topbarPop: null,
  // '?scope=all' (en de oude waarden 'generations'/'3'/'5'/'7') opent uitgeklapt.
  treeScope: ((): TreeScope => {
    const scope = params.get('scope');
    return scope !== null && ['all', 'generations', '3', '5', '7'].includes(scope) ? 'all' : 'circle';
  })(),
  photos: localStorage.getItem(PHOTOS_KEY) === 'on',
  user: null,
  // Lokale (desktop) modus: één synthetische "eigen boom" zodat de bewerk-UI (die
  // op een actieve familie + owner-rol gate't) werkt. Geen cloud, geen wisselen.
  activeFamily: BACKEND === 'local'
    ? { id: 'local', ego: DATASET_EGO[initialDataset], label: 'Mijn boom' }
    : null,
  viewAs: null,
  bridgeReturn: null,
  linkedFamilyIds: [],
  authOpen: false,
  guideOpen: false,
  aboutOpen: false,
  tourOpen: params.get('tour') === '1',
  dataVersion: 0,
  setMode: (mode) => set({ mode }),
  setGlobeLayer: (globeLayer) => set({ globeLayer }),
  setTreeScope: (treeScope) => set({ treeScope }),
  setTopbarPop: (topbarPop) => set({ topbarPop }),
  setLang: (lang) => {
    localStorage.setItem(LANG_KEY, lang);
    set({ lang });
  },
  setDataset: (dataset) =>
    set({ dataset, activeFamily: null, viewAs: null, linkedFamilyIds: [], focusId: DATASET_EGO[dataset], ikId: DATASET_EGO[dataset] }),
  setFocus: (focusId) => set({ focusId }),
  setIk: (ikId) => set({ ikId }),
  toggleTheme: () =>
    set((state) => {
      const theme: ThemeName = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, theme);
      applyTheme(theme);
      return { theme };
    }),
  togglePhotos: () =>
    set((state) => {
      const photos = !state.photos;
      localStorage.setItem(PHOTOS_KEY, photos ? 'on' : 'off');
      return { photos };
    }),
  setUser: (user) => set({ user }),
  setActiveFamily: (family) => {
    if (family) localStorage.setItem(LAST_FAMILY_KEY, family.id);
    set(
      family
        ? { activeFamily: family, viewAs: null, linkedFamilyIds: [], focusId: family.ego, ikId: family.ego, bridgeReturn: null }
        : { activeFamily: null, viewAs: null, linkedFamilyIds: [], bridgeReturn: null },
    );
  },
  setViewAs: (viewAs) => set({ viewAs }),
  crossTo: (family) =>
    set((state) => {
      localStorage.setItem(LAST_FAMILY_KEY, family.id);
      // Onthoud waar je vandaan kwam (alleen het eerste vertrekpunt bij meerdere sprongen).
      return {
        activeFamily: family,
        viewAs: null,
        linkedFamilyIds: [],
        focusId: family.ego,
        ikId: family.ego,
        bridgeReturn: state.bridgeReturn ?? state.activeFamily,
      };
    }),
  crossBack: () =>
    set((state) => {
      const back = state.bridgeReturn;
      if (!back) return {};
      localStorage.setItem(LAST_FAMILY_KEY, back.id);
      return { activeFamily: back, viewAs: null, linkedFamilyIds: [], focusId: back.ego, ikId: back.ego, bridgeReturn: null };
    }),
  toggleLinkedFamily: (familyId) =>
    set((state) => ({
      linkedFamilyIds: state.linkedFamilyIds.includes(familyId)
        ? state.linkedFamilyIds.filter((id) => id !== familyId)
        : [...state.linkedFamilyIds, familyId],
    })),
  setAuthOpen: (authOpen) => set({ authOpen }),
  setGuideOpen: (guideOpen) => set({ guideOpen }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
  setTourOpen: (tourOpen) => set({ tourOpen }),
  setNotice: (notice) => set({ notice }),
  dialog: null,
  setDialog: (dialog) => set({ dialog }),
  bumpData: () => set((state) => ({ dataVersion: state.dataVersion + 1 })),
}));

/** In-app bevestiging (vervangt window.confirm; werkt ook in de Tauri-webview). */
export function askConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    useAppStore.getState().setDialog({ kind: 'confirm', message, resolve: (v) => resolve(v !== null) });
  });
}

/** In-app tekstinvoer (vervangt window.prompt). Geeft de string of null (annuleer). */
export function askPrompt(message: string, defaultValue = ''): Promise<string | null> {
  return new Promise((resolve) => {
    useAppStore.getState().setDialog({ kind: 'prompt', message, defaultValue, resolve });
  });
}
