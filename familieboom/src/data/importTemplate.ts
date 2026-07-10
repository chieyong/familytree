// Platte-template import: één regel per persoon, met een zelfgekozen sleutel
// (kolom `id`) waarnaar `vader_id` / `moeder_id` / `partner_id` verwijzen.
// Parse + valideer hier; de import_family-RPC doet de daadwerkelijke insert.

import type { FamilyGraph } from './types';

export interface ImportPerson {
  key: string;
  /** Echte database-id (db_id-kolom). Gezet = bestaande persoon → bijwerken;
   *  leeg = nieuwe persoon → aanmaken. */
  dbId?: string;
  givenNames: string[];
  familyName?: string;
  nameNative?: string;
  callName?: string;
  nicknames?: string[];
  sex?: 'm' | 'f' | 'x';
  birthYear?: number;
  deathYear?: number;
  visibility?: 'public' | 'family' | 'private';
  /** Plaatsnaam; bij import client-side gegeocodeerd naar coördinaten. */
  birthPlace?: string;
  deathPlace?: string;
  residences?: { name: string; fromYear?: number }[];
}

export interface ImportData {
  persons: ImportPerson[];
  parentLinks: { parent: string; child: string }[];
  unions: { a: string; b: string }[];
}

export interface ParseResult {
  data: ImportData;
  errors: string[];
  /** Niet-blokkerende opmerkingen (bv. genegeerde geslacht-waarde). */
  warnings: string[];
  /** Verwezen sleutels die geen eigen regel hebben → koppelen aan bestaand persoon. */
  externalKeys: string[];
}

/** Kolomnamen in het template (NL), met enkele synoniemen. `roepnaam` is nu een
 *  eigen veld (call) — losgekoppeld van voornaam/bijnaam. */
const COLUMNS: Record<string, string[]> = {
  dbId: ['db_id', 'database_id', 'bestaand_id', 'uuid'],
  id: ['id', 'sleutel', 'key'],
  given: ['voornaam', 'voornamen', 'given'],
  family: ['achternaam', 'familienaam', 'family'],
  native: ['eigen_schrift', 'eigen schrift', 'schrift', 'native'],
  nick: ['bijnaam', 'bijnamen', 'alias', 'nickname'],
  call: ['roepnaam', 'call_name', 'callname', 'roep'],
  sex: ['geslacht', 'sekse', 'sex'],
  birth: ['geboorte', 'geboortejaar', 'geb', 'birth'],
  death: ['overlijden', 'sterfjaar', 'overl', 'death'],
  birthPlace: ['geboorteplaats', 'birthplace'],
  deathPlace: ['sterfteplaats', 'sterfplaats', 'deathplace'],
  residences: ['woonplaatsen', 'woonplaats', 'residences'],
  visibility: ['zichtbaarheid', 'visibility'],
  father: ['vader_id', 'vader', 'father'],
  mother: ['moeder_id', 'moeder', 'mother'],
  partner: ['partner_id', 'partner'],
};

// Voorbeeld-template om te downloaden — zelfde kolommen als de export.
// `db_id` laat je leeg bij nieuwe personen (gevuld = bestaande persoon bijwerken).
// `id` is een vrije sleutel waar vader_id/moeder_id/partner_id naar verwijzen.
// Meerdere bijnamen scheid je met " | "; woonplaatsen met "; " (optioneel jaar
// tussen haakjes). Zichtbaarheid: familie of privé.
export const TEMPLATE_CSV = [
  'db_id,id,voornaam,achternaam,eigen_schrift,bijnaam,roepnaam,geslacht,geboorte,geboorteplaats,overlijden,sterfteplaats,woonplaatsen,zichtbaarheid,vader_id,moeder_id,partner_id',
  ',opa,Jan,de Vries,,Jantje,,m,1940,Utrecht,2010,Amsterdam,,familie,,,oma',
  ',oma,Maria,Bakker,,,,f,1942,Rotterdam,,,Amsterdam,familie,,,opa',
  ',vader,Piet,de Vries,,,Pietje,m,1968,Amsterdam,,,,familie,opa,oma,moeder',
  ',moeder,Anne,Smit,,,,f,1970,Den Haag,,,,familie,,,vader',
  ',kind,Lisa,de Vries,林麗莎,Lies | Liesje,,f,1995,Amsterdam,,,Utrecht (2015); Berlijn (2020),privé,vader,moeder,',
].join('\n');

function detectDelimiter(headerLine: string): string {
  if (headerLine.includes('\t')) return '\t';
  if (headerLine.includes(';')) return ';';
  return ',';
}

/** RFC4180-achtige rij-parser, geparametriseerd op scheidingsteken. */
function splitRow(line: string, delim: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') {
      quoted = true;
    } else if (c === delim) {
      out.push(field); field = '';
    } else field += c;
  }
  out.push(field);
  return out.map((f) => f.trim());
}

function mapSex(raw: string): 'm' | 'f' | 'x' | undefined {
  const v = raw.toLowerCase();
  if (['m', 'man', 'male', 'jongen'].includes(v)) return 'm';
  if (['v', 'f', 'vrouw', 'female', 'meisje'].includes(v)) return 'f';
  if (['x', 'non-binair', 'anders'].includes(v)) return 'x';
  return undefined;
}

function mapVisibility(raw: string): 'public' | 'family' | 'private' | undefined {
  const v = raw.toLowerCase();
  if (['private', 'privé', 'prive', 'privaat'].includes(v)) return 'private';
  if (['family', 'familie', 'gezin'].includes(v)) return 'family';
  if (['public', 'openbaar', 'publiek'].includes(v)) return 'public';
  return undefined;
}

/** "Amsterdam (2000); Rotterdam" → [{name:'Amsterdam',fromYear:2000},{name:'Rotterdam'}]. */
function parseResidences(raw: string): { name: string; fromYear?: number }[] {
  if (!raw.trim()) return [];
  return raw
    .split(';')
    .map((part) => {
      const m = part.trim().match(/^(.*?)(?:\s*\((\d{1,4})\))?$/);
      const name = (m?.[1] ?? part).trim();
      const year = m?.[2] ? Number(m[2]) : undefined;
      return name ? { name, fromYear: year } : null;
    })
    .filter((r): r is { name: string; fromYear?: number } => r !== null);
}

function headerIndex(header: string[]): Record<string, number> {
  const norm = header.map((h) => h.toLowerCase().trim());
  const idx: Record<string, number> = {};
  for (const [field, names] of Object.entries(COLUMNS)) {
    idx[field] = norm.findIndex((h) => names.includes(h));
  }
  return idx;
}

export function parseTemplate(text: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const empty: ImportData = { persons: [], parentLinks: [], unions: [] };

  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) {
    return { data: empty, errors: ['Geen gegevens gevonden (kopregel + minstens één persoon nodig).'], warnings, externalKeys: [] };
  }

  const delim = detectDelimiter(lines[0]);
  const header = splitRow(lines[0], delim);
  const col = headerIndex(header);

  if (col.id < 0) errors.push('Kolom "id" ontbreekt — die is verplicht (de sleutel per persoon).');
  if (col.given < 0) errors.push('Kolom "voornaam" ontbreekt — die is verplicht.');
  if (errors.length) return { data: empty, errors, warnings, externalKeys: [] };

  const persons: ImportPerson[] = [];
  const parentLinks: { parent: string; child: string }[] = [];
  const unionPairs = new Set<string>();
  const unions: { a: string; b: string }[] = [];
  const keys = new Set<string>();
  const refs: { who: string; key: string; row: number }[] = [];

  const cell = (cells: string[], i: number): string => (i >= 0 ? (cells[i] ?? '').trim() : '');
  const year = (raw: string, label: string, row: number): number | undefined => {
    if (!raw) return undefined;
    const n = Number(raw);
    if (!Number.isInteger(n)) { warnings.push(`Regel ${row}: ${label} "${raw}" is geen jaartal — overgeslagen.`); return undefined; }
    return n;
  };

  lines.slice(1).forEach((line, n) => {
    const row = n + 2; // 1-based incl. kopregel
    const cells = splitRow(line, delim);
    const key = cell(cells, col.id);
    const given = cell(cells, col.given);
    const dbId = cell(cells, col.dbId);
    if (!key) { errors.push(`Regel ${row}: lege id (sleutel).`); return; }
    if (keys.has(key)) { errors.push(`Regel ${row}: dubbele id "${key}".`); return; }
    if (!given) { errors.push(`Regel ${row}: lege voornaam.`); return; }
    keys.add(key);

    const sexRaw = cell(cells, col.sex);
    const sex = sexRaw ? mapSex(sexRaw) : undefined;
    if (sexRaw && !sex) warnings.push(`Regel ${row}: geslacht "${sexRaw}" niet herkend — leeg gelaten.`);

    const visRaw = cell(cells, col.visibility);
    const visibility = visRaw ? mapVisibility(visRaw) : undefined;
    if (visRaw && !visibility) warnings.push(`Regel ${row}: zichtbaarheid "${visRaw}" niet herkend — standaard 'familie'.`);

    // Bijnamen kunnen met " | " gescheiden in één cel staan (zoals de export ze schrijft).
    const nicknames = cell(cells, col.nick)
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
    const residences = parseResidences(cell(cells, col.residences));

    persons.push({
      key,
      dbId: dbId || undefined,
      givenNames: given.split(/\s+/).filter(Boolean),
      familyName: cell(cells, col.family) || undefined,
      nameNative: cell(cells, col.native) || undefined,
      callName: cell(cells, col.call) || undefined,
      nicknames: nicknames.length ? nicknames : undefined,
      sex,
      birthYear: year(cell(cells, col.birth), 'geboorte', row),
      deathYear: year(cell(cells, col.death), 'overlijden', row),
      visibility,
      birthPlace: cell(cells, col.birthPlace) || undefined,
      deathPlace: cell(cells, col.deathPlace) || undefined,
      residences: residences.length ? residences : undefined,
    });

    const father = cell(cells, col.father);
    const mother = cell(cells, col.mother);
    const partner = cell(cells, col.partner);
    if (father) { parentLinks.push({ parent: father, child: key }); refs.push({ who: 'vader_id', key: father, row }); }
    if (mother) { parentLinks.push({ parent: mother, child: key }); refs.push({ who: 'moeder_id', key: mother, row }); }
    if (partner) {
      refs.push({ who: 'partner_id', key: partner, row });
      const pair = [key, partner].sort().join(' ');
      if (!unionPairs.has(pair)) { unionPairs.add(pair); unions.push({ a: key, b: partner }); }
    }
  });

  // Verwijzingen naar een id die geen eigen regel heeft = koppeling aan een
  // bestaand persoon in de boom; verzamel ze (de modal laat de gebruiker ze
  // aan een bestaand knooppunt koppelen).
  const externalKeys: string[] = [];
  for (const r of refs) {
    if (!keys.has(r.key) && !externalKeys.includes(r.key)) externalKeys.push(r.key);
  }

  return { data: { persons, parentLinks, unions }, errors, warnings, externalKeys };
}

// ───────────────────────────────────────────────────────────────────────────
// Export → CSV in (een superset van) hetzelfde platte sjabloon. De kern-kolommen
// (id, voornaam, achternaam, eigen_schrift, bijnaam, geslacht, geboorte,
// overlijden, vader_id, moeder_id, partner_id) leest de importer hierboven al
// terug; de extra kolommen (roepnaam, plaatsen, woonplaatsen, zichtbaarheid)
// negeert 'ie voorlopig — die worden bij de import-uitbreiding meegenomen.
//
// Kolomvolgorde is bewust: 'bijnaam' staat vóór 'roepnaam', zodat de bijnaam-
// synoniemzoeker (die ook 'roepnaam' kent) op 'bijnaam' bindt en niet de
// roepnaam als bijnaam inleest.
// ───────────────────────────────────────────────────────────────────────────

// `db_id` = de echte database-id (laat 'm met rust; leeg = nieuwe persoon). `id`
// = leesbare sleutel waarnaar vader_id/moeder_id/partner_id verwijzen.
const EXPORT_HEADER = [
  'db_id', 'id', 'voornaam', 'achternaam', 'eigen_schrift', 'bijnaam', 'roepnaam',
  'geslacht', 'geboorte', 'geboorteplaats', 'overlijden', 'sterfteplaats',
  'woonplaatsen', 'zichtbaarheid', 'vader_id', 'moeder_id', 'partner_id',
] as const;

/** Eén CSV-veld quoten als het een scheidingsteken, quote of newline bevat. */
function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Kebab-case, accenten gevouwen, niet-Latijnse tekens weggelaten. */
function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Leesbare, bestand-unieke sleutel per persoon: voornaam-achternaam-geboortejaar.
 * Bij een botsing komt de geboorteplaats erbij, en anders een teller. Niet-
 * Latijnse namen die niets leesbaars opleveren vallen terug op 'persoon'.
 */
function buildKeys(graph: FamilyGraph): Map<string, string> {
  const used = new Set<string>();
  const keyById = new Map<string, string>();
  for (const p of graph.persons) {
    const name = slugify([...p.givenNames, p.familyName ?? ''].join(' '));
    const year = p.birth?.date?.year;
    const base = [name, year != null ? String(year) : ''].filter(Boolean).join('-') || 'persoon';

    let key = base;
    if (used.has(key)) {
      const place = slugify(p.birth?.place?.name ?? '');
      if (place && !used.has(`${base}-${place}`)) {
        key = `${base}-${place}`;
      } else {
        let n = 2;
        while (used.has(`${base}-${n}`)) n++;
        key = `${base}-${n}`;
      }
    }
    used.add(key);
    keyById.set(p.id, key);
  }
  return keyById;
}

/**
 * Zet een familie-graaf om in CSV (importsjabloon-formaat). Eén regel per
 * persoon; ouders worden op geslacht als vader/moeder gezet (bij onbekend
 * geslacht: eerste = vader, tweede = moeder), partner_id verwijst naar de eerste
 * partner. Het platte formaat kan niet álles vatten (meerdere partners/ouderparen
 * gaan deels verloren) — voldoende om te bekijken en te bewerken in een sheet.
 */
export function exportFamilyCsv(graph: FamilyGraph): string {
  const byId = new Map(graph.persons.map((p) => [p.id, p]));
  // Leesbare sleutels; relatie-verwijzingen gebruiken dezelfde.
  const keyById = buildKeys(graph);
  const keyOf = (id: string) => keyById.get(id) ?? '';

  // Ouders per kind (met behoud van volgorde) en de eerste partner per persoon.
  const parentsByChild = new Map<string, string[]>();
  for (const link of graph.parentLinks) {
    const list = parentsByChild.get(link.child) ?? [];
    if (!list.includes(link.parent)) list.push(link.parent);
    parentsByChild.set(link.child, list);
  }
  const firstPartner = new Map<string, string>();
  for (const u of graph.unions) {
    const [a, b] = u.partners;
    if (!firstPartner.has(a)) firstPartner.set(a, b);
    if (!firstPartner.has(b)) firstPartner.set(b, a);
  }

  const rows = graph.persons.map((p) => {
    // Ouders splitsen naar vader/moeder op geslacht; onbekend → op volgorde.
    const parents = parentsByChild.get(p.id) ?? [];
    let father = '';
    let mother = '';
    for (const pid of parents) {
      const sex = byId.get(pid)?.sex;
      if (sex === 'm' && !father) father = pid;
      else if (sex === 'f' && !mother) mother = pid;
      else if (!father) father = pid;
      else if (!mother) mother = pid;
    }

    const residences = (p.residences ?? [])
      .map((r) => (r.from?.year ? `${r.place.name} (${r.from.year})` : r.place.name))
      .join('; ');

    const cells: Record<(typeof EXPORT_HEADER)[number], string> = {
      db_id: p.id,
      id: keyOf(p.id),
      voornaam: p.givenNames.join(' '),
      achternaam: p.familyName ?? '',
      eigen_schrift: p.nameNative ?? '',
      bijnaam: (p.nicknames ?? []).join(' | '),
      roepnaam: p.callName ?? '',
      geslacht: p.sex ?? '',
      geboorte: p.birth?.date?.year != null ? String(p.birth.date.year) : '',
      geboorteplaats: p.birth?.place?.name ?? '',
      overlijden: p.death?.date?.year != null ? String(p.death.date.year) : '',
      sterfteplaats: p.death?.place?.name ?? '',
      woonplaatsen: residences,
      zichtbaarheid: p.visibility,
      vader_id: keyOf(father),
      moeder_id: keyOf(mother),
      partner_id: keyOf(firstPartner.get(p.id) ?? ''),
    };
    return EXPORT_HEADER.map((h) => csvCell(cells[h])).join(',');
  });

  return [EXPORT_HEADER.join(','), ...rows].join('\n');
}
