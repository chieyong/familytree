import { useState } from 'react';

/** Subtiele "?"-knop in de topbar die de privacy-uitleg opent. */
export function PrivacyInfo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="info-toggle"
        onClick={() => setOpen(true)}
        aria-label="Hoe werkt privacy?"
        title="Hoe werkt privacy?"
      >
        ?
      </button>
      {open && (
        <div className="auth-overlay" onClick={() => setOpen(false)}>
          <div className="info-card" onClick={(e) => e.stopPropagation()}>
            <div className="info-head">
              <h2>Hoe werkt privacy?</h2>
              <button className="panel-close" onClick={() => setOpen(false)} aria-label="Sluiten">
                ×
              </button>
            </div>

            <p className="info-intro">
              Een familieboom is privé. Jij beslist wie wat ziet — per persoon én per relatie.
            </p>

            <h3>1. Besloten, op uitnodiging</h3>
            <p>
              Niemand kan je boom vinden of openen zonder uitnodiging. Een uitgelogde bezoeker ziet
              alleen de demo. Je deelt via een link; wie zich aanmeldt staat eerst <em>in afwachting</em>
              en wordt pas lid als de beheerder goedkeurt.
            </p>

            <h3>2. Drie niveaus van zichtbaarheid</h3>
            <p>Elke persoon — en elke relatie — heeft een zichtbaarheid:</p>
            <ul>
              <li><strong>Openbaar</strong> — voor iedereen, ook zonder login (voor wat je bewust deelt).</li>
              <li><strong>Familie</strong> — voor alle leden van deze boom (standaard).</li>
              <li><strong>Privé</strong> — alleen voor de beheerder.</li>
            </ul>
            <p>Geldt er meer dan één instelling, dan <strong>wint de strengste</strong>.</p>
            <p className="info-ex">
              Voorbeeld: je oma wil haar geboortejaar niet met de hele familie delen → zet haar op
              privé; alleen de beheerder ziet haar dan.
            </p>

            <h3>3. Je gaat over jezelf</h3>
            <p>
              Je mag je eigen gegevens altijd <em>strenger</em> zetten dan een beheerder deed — ook al
              beheert iemand anders jouw knooppunt.
            </p>

            <h3>4. Verborgen, maar de boom blijft kloppen</h3>
            <p>
              Een afgeschermde persoon verdwijnt niet helemaal: anderen zien “verborgen persoon” op die
              plek, zodat verbindingen — en wie familie van wie is — blijven kloppen binnen je eigen boom.
            </p>

            <h3>5. Gedeelde feiten</h3>
            <p>
              Een huwelijk of ouder–kindband is van twee mensen samen — een gedeeld feit. Zo'n band
              blijft standaard zichtbaar voor de familie, zodat de stamboom klopt en je kunt zien wie
              familie van wie is (twee kinderen zijn alleen halfbroers omdat de gedeelde ouder–band
              bestaat).
            </p>
            <p className="info-ex">
              Het apart, fijnmazig afschermen van losse relaties — en een band alleen met instemming van
              beide kanten verbergen — is ontworpen maar zit nog niet in deze versie.
            </p>

            <h3>6. Rollen</h3>
            <ul>
              <li><strong>Beheerder</strong> — beheert leden en de boom.</li>
              <li><strong>Bewerker</strong> — voegt personen toe en wijzigt wat hij beheert.</li>
              <li><strong>Lezer</strong> — bekijkt alleen.</li>
            </ul>

            <h3>Eerlijk: wat “verborgen” wél en niet betekent</h3>
            <p>
              Verbergen beschermt tegen toevallig meekijken en tegen buitenstaanders. Het is géén
              garantie tegen een familielid dat goed nadenkt: uit wie wél zichtbaar is, valt soms af te
              leiden wie verborgen is (een zichtbare halfbroer verraadt een gedeelde ouder). Voor een écht
              geheim kun je iemand beter helemaal niet invoeren.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
