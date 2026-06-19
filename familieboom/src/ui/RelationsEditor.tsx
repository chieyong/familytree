import { useState } from 'react';
import type { FamilyGraph, ParentChildLink, ParentRole, Person, Union, UnionEndReason, UnionType } from '../data/types';
import {
  deleteParentLink,
  deleteUnion,
  setParentRole,
  setUnionEnd,
  setUnionType,
} from '../data/mutations';
import { shortName } from './theme';
import { useAppStore } from './store';
import { useT } from './useT';

const UNION_TYPES: UnionType[] = ['marriage', 'registered', 'cohabitation', 'relationship'];
const END_REASONS: UnionEndReason[] = ['divorce', 'separation', 'death'];
const ROLES: ParentRole[] = ['biological', 'adoptive', 'step', 'foster'];

function useAfter() {
  const bumpData = useAppStore((s) => s.bumpData);
  return async (p: Promise<void>) => {
    await p;
    bumpData();
  };
}

function UnionRow({ union, otherName }: { union: Union; otherName: string }) {
  const after = useAfter();
  const t = useT();
  const reason = union.end?.reason ?? '';
  return (
    <div className="rel-row">
      <span className="rel-name">{otherName}</span>
      <select value={union.type} onChange={(e) => after(setUnionType(union.id, e.target.value as UnionType))}>
        {UNION_TYPES.map((v) => (
          <option key={v} value={v}>{t.relations[v]}</option>
        ))}
      </select>
      <select
        value={reason}
        onChange={(e) =>
          after(setUnionEnd(union.id, (e.target.value || null) as UnionEndReason | null, union.end?.date?.year))
        }
      >
        <option value="">{t.relations.ongoing}</option>
        {END_REASONS.map((v) => (
          <option key={v} value={v}>{t.relations[v]}</option>
        ))}
      </select>
      {reason && (
        <input
          className="rel-year"
          placeholder={t.relations.year}
          defaultValue={union.end?.date?.year ?? ''}
          onBlur={(e) => {
            const y = e.target.value.replace(/\D/g, '');
            after(setUnionEnd(union.id, reason as UnionEndReason, y ? Number(y) : undefined));
          }}
        />
      )}
      <button className="rel-unlink" title={t.relations.unlink} onClick={() => after(deleteUnion(union.id))}>
        ✕
      </button>
    </div>
  );
}

function LinkRow({ link, otherName, word }: { link: ParentChildLink; otherName: string; word: string }) {
  const after = useAfter();
  const t = useT();
  return (
    <div className="rel-row">
      <span className="rel-name">
        {otherName} <em>{word}</em>
      </span>
      <select value={link.role} onChange={(e) => after(setParentRole(link.id, e.target.value as ParentRole))}>
        {ROLES.map((v) => (
          <option key={v} value={v}>{t.relations[v]}</option>
        ))}
      </select>
      <button className="rel-unlink" title={t.relations.unlink} onClick={() => after(deleteParentLink(link.id))}>
        ✕
      </button>
    </div>
  );
}

/** CRUD: relaties van de focuspersoon bewerken/ontkoppelen (eigen boom). */
export function RelationsEditor({
  person,
  graph,
  embedded,
  readOnly,
}: {
  person: Person;
  graph: FamilyGraph | undefined;
  embedded?: boolean;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(embedded ?? false);
  const t = useT();
  if (!graph) return null;

  const name = (id: string) => {
    const p = graph.persons.find((x) => x.id === id);
    return p ? shortName(p) : '?';
  };
  const partners = graph.unions.filter((u) => u.partners.includes(person.id));
  const parents = graph.parentLinks.filter((l) => l.child === person.id);
  const children = graph.parentLinks.filter((l) => l.parent === person.id);
  const total = partners.length + parents.length + children.length;

  // Read-only: relaties opengeklapt tonen zonder bedieningsknoppen.
  if (readOnly) {
    if (total === 0) return <div className="family-empty">{t.relations.none}</div>;
    return (
      <div className="relations-view">
        {partners.map((u) => {
          const other = name(u.partners[0] === person.id ? u.partners[1] : u.partners[0]);
          const type = u.type ? t.relations[u.type] : '';
          const ended = u.end?.reason ? ` · ${t.relations[u.end.reason]}` : '';
          return (
            <div className="rel-view-row" key={u.id}>
              <span className="rel-name">{other}</span>
              <em>{type}{ended}</em>
            </div>
          );
        })}
        {parents.map((l) => (
          <div className="rel-view-row" key={l.id}>
            <span className="rel-name">{name(l.parent)}</span>
            <em>{t.relations.wordParent}{l.role !== 'biological' ? ` · ${t.relations[l.role]}` : ''}</em>
          </div>
        ))}
        {children.map((l) => (
          <div className="rel-view-row" key={l.id}>
            <span className="rel-name">{name(l.child)}</span>
            <em>{t.relations.wordChild}{l.role !== 'biological' ? ` · ${t.relations[l.role]}` : ''}</em>
          </div>
        ))}
      </div>
    );
  }

  if (!open) {
    return (
      <button className="add-rel-btn" onClick={() => setOpen(true)}>
        {t.relations.summary(partners.length, parents.length, children.length)} ✎
      </button>
    );
  }

  return (
    <div className="relations-editor">
      {partners.map((u) => (
        <UnionRow
          key={u.id}
          union={u}
          otherName={name(u.partners[0] === person.id ? u.partners[1] : u.partners[0])}
        />
      ))}
      {parents.map((l) => (
        <LinkRow key={l.id} link={l} otherName={name(l.parent)} word={t.relations.wordParent} />
      ))}
      {children.map((l) => (
        <LinkRow key={l.id} link={l} otherName={name(l.child)} word={t.relations.wordChild} />
      ))}
      {total === 0 && <div className="family-empty">{t.relations.none}</div>}
      {!embedded && (
        <button className="add-rel-cancel" onClick={() => setOpen(false)}>{t.relations.close}</button>
      )}
    </div>
  );
}
