/**
 * Alle uitleg-teksten op één plek: de welkomstkaart (eerste login) en de
 * hulpgids (?-knop). Bewust losgekoppeld van de componenten zodat een
 * taalkeuze later eenvoudig is.
 *
 * i18n (later): maak hier `const nl = {…}; const en = {…}; const zh = {…}` en
 * exporteer `guides: Record<Lang, GuideContent>`. De componenten lezen dan
 * `guides[lang]` op basis van een keuze in de store. Niets anders verandert.
 */

export interface GuideItem {
  /** Vetgedrukt kopje vóór de tekst, bv. "Tree". */
  label?: string;
  text: string;
}

/** Een rijk sub-onderdeel binnen een sectie, met een eigen kopje. */
export interface GuideBlock {
  /** Subkopje. */
  h?: string;
  p?: string[];
  items?: GuideItem[];
  note?: string;
}

export interface GuideSection {
  /** Titel in de samenvouwbare kop. */
  q: string;
  /** Alinea's. */
  p?: string[];
  /** Opsomming. */
  items?: GuideItem[];
  /** Terzijde, met accentrand (bv. een voorbeeld of een let-op). */
  note?: string;
  /** Meerdelige inhoud met subkopjes (bv. privacy). */
  blocks?: GuideBlock[];
}

export interface GuideContent {
  welcome: {
    title: string;
    intro: string;
    leadIn: string;
    steps: { title: string; body: string }[];
    start: string;
    more: string;
  };
  guide: {
    title: string;
    intro: string;
    sections: GuideSection[];
  };
}

const nl: GuideContent = {
  welcome: {
    title: 'Welkom bij Bloom 🌱',
    intro: 'Bloom tekent je familie als een levend web rond één persoon — meestal jij.',
    leadIn: 'In drie stappen sta je erin:',
    steps: [
      {
        title: 'Dit ben ik',
        body: 'Vind jezelf in de boom of maak je eigen persoon aan. Vanaf daar worden alle relaties benoemd: "oma", "neef", "partner".',
      },
      {
        title: 'Voeg familie toe',
        body: 'Klik op jezelf en voeg een ouder, partner of kind toe. Zo groeit de boom vanzelf.',
      },
      {
        title: 'Nodig anderen uit',
        body: 'Laat familie meebouwen — ieder vult aan wat hij weet.',
      },
    ],
    start: 'Aan de slag',
    more: 'Meer uitleg',
  },
  guide: {
    title: 'Hoe werkt Bloom?',
    intro:
      'Bloom is een familieboom die meedenkt vanuit perspectief: je ziet je familie als een web rond één persoon, met de relaties benoemd zoals jíj ze kent.',
    sections: [
      {
        q: 'De twee weergaven',
        p: ['Wissel rechtsboven tussen de twee manieren om je familie te bekijken.'],
        items: [
          { label: 'Tree', text: 'de werkweergave. Hier navigeer je, bewerk je personen en bekijk je foto’s. Klik op iemand om in te zoomen.' },
          { label: 'Tableau', text: 'een rustig, artistiek overzicht van de hele familie. Mooi om naar te kijken of te delen, niet om in te werken.' },
        ],
      },
      {
        q: 'Privacy & zichtbaarheid',
        p: ['Een familieboom is privé. Jij beslist wie wat ziet — per persoon én per relatie.'],
        blocks: [
          {
            h: 'Besloten, op uitnodiging',
            p: [
              'Niemand kan je boom vinden of openen zonder uitnodiging. Een uitgelogde bezoeker ziet alleen de demo. Je deelt via een link; wie zich aanmeldt staat eerst in afwachting en wordt pas lid als de beheerder goedkeurt.',
            ],
          },
          {
            h: 'Drie niveaus van zichtbaarheid',
            p: ['Elke persoon — en elke relatie — heeft een zichtbaarheid:'],
            items: [
              { label: 'Openbaar', text: 'voor iedereen, ook zonder login (voor wat je bewust deelt).' },
              { label: 'Familie', text: 'voor alle leden van deze boom (standaard).' },
              { label: 'Privé', text: 'alleen voor de beheerder.' },
            ],
            note: 'Geldt er meer dan één instelling, dan wint de strengste. Voorbeeld: je oma wil haar geboortejaar niet met de hele familie delen → zet haar op privé; alleen de beheerder ziet haar dan.',
          },
          {
            h: 'Je gaat over jezelf',
            p: [
              'Je mag je eigen gegevens altijd strenger zetten dan een beheerder deed — ook al beheert iemand anders jouw knooppunt.',
            ],
          },
          {
            h: 'Verborgen, maar de boom blijft kloppen',
            p: [
              'Een afgeschermde persoon verdwijnt niet helemaal: anderen zien "verborgen persoon" op die plek, zodat verbindingen — en wie familie van wie is — blijven kloppen binnen je eigen boom.',
            ],
          },
          {
            h: 'Gedeelde feiten',
            p: [
              'Een huwelijk of ouder–kindband is van twee mensen samen — een gedeeld feit. Zo’n band blijft standaard zichtbaar voor de familie, zodat de stamboom klopt en je kunt zien wie familie van wie is.',
            ],
            note: 'Het apart, fijnmazig afschermen van losse relaties — en een band alleen met instemming van beide kanten verbergen — is ontworpen maar zit nog niet in deze versie.',
          },
          {
            h: 'Wat "verborgen" wél en niet betekent',
            p: [
              'Verbergen beschermt tegen toevallig meekijken en tegen buitenstaanders. Het is géén garantie tegen een familielid dat goed nadenkt: uit wie wél zichtbaar is, valt soms af te leiden wie verborgen is (een zichtbare halfbroer verraadt een gedeelde ouder). Voor een écht geheim kun je iemand beter helemaal niet invoeren.',
            ],
          },
        ],
      },
      {
        q: '"Dit ben ik" en perspectief',
        p: ['Relaties krijgen pas betekenis vanuit iemand: "moeder van Anna", "neef van Tom". Daarom kies je een ik.'],
        items: [
          { label: 'Dit ben ik', text: 'koppelt je account aan een persoon — dat wordt je vaste vertrekpunt.' },
          { label: 'Bekijk vanuit …', text: 'laat je tijdelijk door andermans ogen kijken. Met "terug naar standaard" sta je weer bij jezelf.' },
        ],
      },
      {
        q: 'Personen en relaties toevoegen',
        p: [
          'Klik op een persoon en kies + ouder, + partner of + kind. Je maakt een nieuw persoon aan, of koppelt iemand die al in de familie staat.',
          'In Gegevens vul je naam, jaren en een foto in. Onder "meer details" zitten bijnaam, naam in eigen schrift en zichtbaarheid.',
        ],
      },
      {
        q: 'Samen bouwen',
        p: ['Een familieboom wordt mooier met meer mensen. Nodig familie uit via Delen.'],
        items: [
          { label: 'Beheerder', text: 'mag alles, inclusief uitnodigen en koppelen.' },
          { label: 'Bewerker', text: 'mag personen en relaties aanvullen.' },
          { label: 'Lezer', text: 'bekijkt alleen.' },
        ],
      },
      {
        q: 'Foto’s',
        p: [
          'Zet het foto-icoon bovenin aan om profielfoto’s in de boom te tonen.',
          'Een foto voeg je toe bij een persoon onder Gegevens — uploaden of meteen met de camera.',
        ],
      },
      {
        q: 'Families koppelen (bruggen)',
        p: [
          'Komt dezelfde persoon in twee families voor — bijvoorbeeld door een huwelijk? Dan leg je een brug: de twee bomen blijven apart, maar je kunt van de één naar de ander oversteken.',
          'Beide beheerders moeten het doen: de één maakt een koppelcode, de ander plakt ’m.',
        ],
        note: 'Gevorderd — niet nodig om te beginnen.',
      },
    ],
  },
};

/** Actieve inhoud. i18n (later): vervang door `guides[lang]`. */
export const guideContent: GuideContent = nl;
