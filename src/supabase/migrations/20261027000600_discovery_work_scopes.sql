-- Work definition is an internal, versioned assessment, not an accepted client agreement.
create table if not exists public.discovery_work_scopes (
  id uuid primary key default gen_random_uuid(),
  discovery_id uuid not null references public.discovery_submissions(id) on delete restrict,
  version integer not null check (version > 0),
  work_type text not null check (work_type in ('new_build','redesign','partial_upgrade','existing_service','implementation','other')),
  services text[] not null check (cardinality(services) between 1 and 12),
  project_title text not null check (char_length(project_title) between 3 and 200),
  existing_assets text not null default '',
  scope_summary text not null check (char_length(scope_summary) between 15 and 8000),
  deliverables jsonb not null check (jsonb_typeof(deliverables) = 'array' and jsonb_array_length(deliverables) between 1 and 30),
  exclusions text not null default '',
  dependencies text not null default '',
  acceptance_criteria text not null default '',
  internal_notes text not null default '',
  state text not null default 'draft' check (state in ('draft','ready_for_proposal')),
  created_at timestamptz not null default now(),
  unique(discovery_id,version)
);
create index if not exists discovery_work_scopes_discovery_idx on public.discovery_work_scopes(discovery_id,version desc);
alter table public.discovery_work_scopes enable row level security;
revoke all on public.discovery_work_scopes from anon, authenticated;
grant select, insert on public.discovery_work_scopes to service_role;
-- Prevent retroactive alteration of a saved scope version even via service-role REST calls.
create or replace function public.guard_discovery_scope_immutability() returns trigger language plpgsql as $$
begin
 raise exception 'Saved scope versions are immutable; create a new version';
end $$;
drop trigger if exists discovery_work_scope_immutable on public.discovery_work_scopes;
create trigger discovery_work_scope_immutable before update or delete on public.discovery_work_scopes
for each row execute function public.guard_discovery_scope_immutability();
