create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  email text not null check (char_length(btrim(email)) between 3 and 254),
  company text check (company is null or char_length(btrim(company)) <= 160),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clients_email_normalized_idx
  on public.clients (lower(btrim(email)));

create table if not exists public.client_projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  service_type text not null check (char_length(btrim(service_type)) between 1 and 120),
  status text not null default 'draft'
    check (status in ('draft', 'invited', 'active', 'paused', 'completed', 'cancelled')),
  package_key text,
  package_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(package_snapshot) = 'object'),
  agreed_price numeric(12, 2) check (agreed_price is null or agreed_price >= 0),
  currency char(3) check (currency is null or currency ~ '^[A-Z]{3}$'),
  agreed_scope jsonb not null default '{}'::jsonb
    check (jsonb_typeof(agreed_scope) = 'object'),
  start_date date,
  target_completion_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_projects_price_currency_pair
    check ((agreed_price is null) = (currency is null)),
  constraint client_projects_date_order
    check (start_date is null or target_completion_date is null or target_completion_date >= start_date),
  constraint client_projects_id_client_id_key unique (id, client_id)
);

create index if not exists client_projects_client_created_idx
  on public.client_projects (client_id, created_at desc);

create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '',
  position integer not null check (position >= 0),
  status text not null default 'upcoming'
    check (status in ('upcoming', 'active', 'client_review', 'approved', 'completed')),
  start_date date,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_milestones_project_position_key unique (project_id, position),
  constraint project_milestones_id_project_id_key unique (id, project_id),
  constraint project_milestones_date_order
    check (start_date is null or due_date is null or due_date >= start_date)
);

create table if not exists public.project_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete restrict,
  milestone_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'ready_for_review', 'changes_requested', 'approved', 'completed')),
  due_date date,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_deliverables_milestone_project_fkey
    foreign key (milestone_id, project_id)
    references public.project_milestones (id, project_id) on delete restrict
);

create index if not exists project_deliverables_project_created_idx
  on public.project_deliverables (project_id, created_at);
create index if not exists project_deliverables_milestone_idx
  on public.project_deliverables (milestone_id)
  where milestone_id is not null;

create table if not exists public.project_invitations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  project_id uuid not null,
  email text not null check (char_length(btrim(email)) between 3 and 254),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_invitations_client_project_fkey
    foreign key (project_id, client_id)
    references public.client_projects (id, client_id) on delete restrict
);

create index if not exists project_invitations_project_created_idx
  on public.project_invitations (project_id, created_at desc);
create index if not exists project_invitations_pending_expiry_idx
  on public.project_invitations (expires_at)
  where status = 'pending';

create table if not exists public.project_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete restrict,
  event_type text not null check (event_type in (
    'project_created',
    'invitation_sent',
    'invitation_accepted',
    'milestone_activated',
    'deliverable_submitted',
    'client_feedback_received',
    'deliverable_approved',
    'milestone_completed',
    'project_completed'
  )),
  actor_type text not null default 'system'
    check (actor_type in ('system', 'admin', 'client')),
  actor_id uuid,
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists project_activity_project_created_idx
  on public.project_activity (project_id, created_at desc);

alter table public.discovery_submissions
  add column if not exists qualification_status text not null default 'unqualified'
    check (qualification_status in ('unqualified', 'qualified')),
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists client_project_id uuid references public.client_projects(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'discovery_submissions_project_requires_client'
      and conrelid = 'public.discovery_submissions'::regclass
  ) then
    alter table public.discovery_submissions
      add constraint discovery_submissions_project_requires_client
      check (client_project_id is null or client_id is not null);
  end if;
end $$;

create index if not exists discovery_submissions_client_created_idx
  on public.discovery_submissions (client_id, created_at desc)
  where client_id is not null;
create index if not exists discovery_submissions_client_project_idx
  on public.discovery_submissions (client_project_id)
  where client_project_id is not null;

alter table public.clients enable row level security;
alter table public.client_projects enable row level security;
alter table public.project_milestones enable row level security;
alter table public.project_deliverables enable row level security;
alter table public.project_invitations enable row level security;
alter table public.project_activity enable row level security;

revoke all on public.clients, public.client_projects, public.project_milestones,
  public.project_deliverables, public.project_invitations, public.project_activity
  from public, anon, authenticated;
grant select, insert, update, delete on public.clients, public.client_projects,
  public.project_milestones, public.project_deliverables, public.project_invitations,
  public.project_activity to service_role;

revoke all on public.discovery_submissions from public, anon, authenticated;
grant select, insert, update on public.discovery_submissions to service_role;

comment on table public.clients is
  'Client delivery records. Direct anon/authenticated access is intentionally denied until client identity and tenant-scoped RLS are implemented.';
comment on table public.client_projects is
  'Live client engagements; intentionally separate from public portfolio work_projects.';
comment on column public.client_projects.package_snapshot is
  'Project-level copy of the selected commercial package; do not resolve agreed terms from mutable public pricing.';
comment on column public.client_projects.agreed_scope is
  'Agreed deliverables, limits, and scope captured for this engagement.';
comment on column public.project_invitations.token_hash is
  'SHA-256 hex digest of an invitation secret; never store or expose the raw token.';
comment on table public.project_activity is
  'Lightweight project history, not an event-sourcing log.';
