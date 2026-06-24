-- Migratie 23 — Voorstellen-wachtrij (change_proposals) voor de rol Bijdrager.
--
-- Een bijdrager (of editor/owner) dient een voorstel in i.p.v. direct te
-- schrijven; een owner/editor keurt het goed (toepassen) of wijst het af. v1
-- ondersteunt 'person_update' (wijziging van een bestaande persoon); de payload
-- spiegelt exact de kolommen die updatePerson zet, zodat goedkeuren = toepassen.
--
-- RLS: indienen door owner/editor/contributor (eigen, pending). Lezen: je eigen
-- voorstellen, plus alle voorstellen in je familie als owner/editor. Afhandelen
-- gaat via de security-definer-RPC resolve_proposal (geen client-update-policy).
--
-- Idempotent: if not exists / drop policy if exists / create or replace.

create table if not exists change_proposals (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references families on delete cascade,
  author           uuid not null references profiles on delete cascade,
  author_label     text,
  kind             text not null check (kind in ('person_update')),
  target_person_id uuid references persons on delete cascade,
  payload          jsonb not null default '{}'::jsonb,
  summary          text,
  status           text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at       timestamptz not null default now(),
  resolved_by      uuid references profiles,
  resolved_at      timestamptz
);

create index if not exists idx_change_proposals_family_status
  on change_proposals (family_id, status);

alter table change_proposals enable row level security;
grant select, insert on change_proposals to authenticated;

drop policy if exists change_proposals_insert on change_proposals;
create policy change_proposals_insert on change_proposals for insert
  with check (
    author = auth.uid()
    and status = 'pending'
    and public.role_in_family(family_id) in ('owner', 'editor', 'contributor')
  );

drop policy if exists change_proposals_select on change_proposals;
create policy change_proposals_select on change_proposals for select
  using (
    author = auth.uid()
    or public.role_in_family(family_id) in ('owner', 'editor')
  );

create or replace function public.resolve_proposal(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v change_proposals;
begin
  select * into v from change_proposals where id = p_id;
  if not found then raise exception 'Voorstel niet gevonden'; end if;
  if v.status <> 'pending' then raise exception 'Voorstel is al afgehandeld'; end if;
  if public.role_in_family(v.family_id) not in ('owner', 'editor') then
    raise exception 'Geen rechten om voorstellen af te handelen';
  end if;

  if p_approve and v.kind = 'person_update' and v.target_person_id is not null then
    update persons p set
      given_names = coalesce(
        (select array_agg(x) from jsonb_array_elements_text(v.payload->'given_names') x),
        p.given_names),
      family_name    = v.payload->>'family_name',
      call_name      = v.payload->>'call_name',
      name_native    = v.payload->>'name_native',
      nickname       = v.payload->>'nickname',
      preferred_name = v.payload->>'preferred_name',
      sex            = (v.payload->>'sex')::sex,
      birth_year     = (v.payload->>'birth_year')::int,
      death_year     = (v.payload->>'death_year')::int,
      visibility     = coalesce((v.payload->>'visibility')::visibility, p.visibility)
    where p.id = v.target_person_id and p.family_id = v.family_id;
  end if;

  update change_proposals
    set status = case when p_approve then 'approved' else 'rejected' end,
        resolved_by = auth.uid(),
        resolved_at = now()
  where id = p_id;
end; $$;

grant execute on function public.resolve_proposal(uuid, boolean) to authenticated;
