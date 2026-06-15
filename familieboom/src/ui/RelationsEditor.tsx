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

const UNION_TYPES: { v: UnionType; l: string }[] = [
  { v: 'marriage', l: 'huwelijk' },
  { v: 'registered', l: 'geregistreerd' },
  { v: 'cohabitation', l: 'samenwonend' },
  { v: 'relationship', l: 'relatie' },
];
const END_REASONS: { v: UnionEndReason; l: string }[] = [
  { v: 'divorce', l: 'gescheiden' },
  { v: 'separation', l: 'uit elkaar' },
  { v: 'death', l: 'overlijden' },
];
const ROLES: { v: ParentRole; l: string }[] = [
  { v: 'biological', l: 'biologisch' },
  { v: 'adoptive', l: 'adoptie' },
  { v: 'step', l: 'stief' },
  { v: 'foster', l: 'pleeg' },
];

function useAfter() {
  const bumpData = useAppStore((s) => s.bumpData);
  return async (p: Promise<void>) => {
    await p;
    bumpData();
  };
}

function UnionRow({ union, otherName }: { union: Union; otherName: string }) {
  const after = useAfter();
  const reason = union.end?.reason ?? '';
  return (
    <div className="rel-row">
      <span className="rel-name">{otherName}</span>
      <select value={union.type} onChange={(e) => after(setUnionType(union.id, e.target.value as UnionType))}>
        {UNION_TYPES.map((t) => (
          <option key={t.v} value={t.v}>{t.l}</option>
        ))}
      </select>
      <select
        value={reason}
        onChange={(e) =>
          after(setUnionEnd(union.id, (e.target.value || null) as UnionEndReason | null, union.end?.date?.year))
        }
      >
        <option value="">lopend</option>
        {END_REASONS.map((r) => (
          <option key={r.v} value={r.v}>{r.l}</option>
        ))}
      </select>
      {reason && (
        <input
          className="rel-year"
          placeholder="jaar"
          defaultValue={union.end?.date?.year ?? ''}
          onBlur={(e) => {
            const y = e.target.value.replace(/\D/g, '');
            after(setUnionEnd(union.id, reason as UnionEndReason, y ? Number(y) : undefined));
          }}
        />
      )}
      <button className="rel-unlink" title="ontkoppel" onClick={() => after(deleteUnion(union.id))}>
        ✕
      </button>
    </div>
  );
}

function LinkRow({ link, otherName, word }: { link: ParentChildLink; otherName: string; word: string }) {
  const after = useAfter();
  return (
    <div className="rel-row">
      <span className="rel-name">
        {otherName} <em>{word}</em>
      </span>
      <select value={link.role} onChange={(e) => after(setParentRole(link.id, e.target.value as ParentRole))}>
        {ROLES.map((r) => (
          <option key={r.v} value={r.v}>{r.l}</option>
        ))}
      </select>
      <button className="rel-unlink" title="ontkoppel" onClick={() => after(deleteParentLink(link.id))}>
        ✕
      </button>
    </div>
  );
}

/** CRUD: relaties van de focuspersoon bewerken/ontkoppelen (eigen boom). */
export function RelationsEditor({ person, graph }: { person: Person; graph: FamilyGraph | undefined }) {
  const [open, setOpen] = useState(false);
  if (!graph) return null;

  const name = (id: string) => {
    const p = graph.persons.find((x) => x.id === id);
    return p ? shortName(p) : '?';
  };
  const partners = graph.unions.filter((u) => u.partners.includes(person.id));
  const parents = graph.parentLinks.filter((l) => l.child === person.id);
  const children = graph.parentLinks.filter((l) => l.parent === person.id);
  const total = partners.length + parents.length + children.length;

  if (!open) {
    return (
      <button className="add-rel-btn" onClick={() => setOpen(true)}>
        relaties{total ? ` (${total})` : ''}
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
        <LinkRow key={l.id} link={l} otherName={name(l.parent)} word="ouder" />
      ))}
      {children.map((l) => (
        <LinkRow key={l.id} link={l} otherName={name(l.child)} word="kind" />
      ))}
      {total === 0 && <div className="family-empty">geen relaties</div>}
      <button className="add-rel-cancel" onClick={() => setOpen(false)}>sluiten</button>
    </div>
  );
}
