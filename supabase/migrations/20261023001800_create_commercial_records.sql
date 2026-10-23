create table if not exists public.project_proposals (
  id uuid primary key default gen_random_uuid(),
  proposal_number text not null unique
    check (char_length(btrim(proposal_number)) between 1 and 80),
  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  summary text not null default '',
  scope jsonb not null default '{}'::jsonb
    check (jsonb_typeof(scope) = 'object'),
  deliverables jsonb not null default '[]'::jsonb
    check (jsonb_typeof(deliverables) = 'array'),
  exclusions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(exclusions) = 'array'),
  timeline jsonb not null default '{}'::jsonb
    check (jsonb_typeof(timeline) = 'object'),
  milestones jsonb not null default '[]'::jsonb
    check (jsonb_typeof(milestones) = 'array'),
  payment_schedule jsonb not null default '[]'::jsonb
    check (jsonb_typeof(payment_schedule) = 'array'),
  amount numeric(12, 2) not null check (amount >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  notes text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')),
  expires_at timestamptz,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_proposals_client_project_fkey
    foreign key (project_id, client_id)
    references public.client_projects (id, client_id) on delete restrict,
  constraint project_proposals_id_client_project_key
    unique (id, client_id, project_id),
  constraint project_proposals_accepted_state
    check (status <> 'accepted' or accepted_at is not null),
  constraint project_proposals_declined_state
    check (status <> 'declined' or declined_at is not null)
);

create index if not exists project_proposals_client_created_idx
  on public.project_proposals (client_id, created_at desc);
create index if not exists project_proposals_project_created_idx
  on public.project_proposals (project_id, created_at desc);

create table if not exists public.project_agreements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid not null,
  proposal_id uuid,
  version integer not null check (version > 0),
  terms text not null check (char_length(btrim(terms)) > 0),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'declined', 'superseded')),
  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  accepted_by_auth_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_agreements_client_project_fkey
    foreign key (project_id, client_id)
    references public.client_projects (id, client_id) on delete restrict,
  constraint project_agreements_proposal_fkey
    foreign key (proposal_id, client_id, project_id)
    references public.project_proposals (id, client_id, project_id) on delete restrict,
  constraint project_agreements_acceptance_pair
    check ((accepted_at is null) = (accepted_by_auth_user_id is null)),
  constraint project_agreements_accepted_state
    check (status <> 'accepted' or accepted_at is not null),
  constraint project_agreements_declined_state
    check (status <> 'declined' or declined_at is not null),
  constraint project_agreements_id_client_project_key
    unique (id, client_id, project_id),
  constraint project_agreements_project_version_key
    unique (project_id, version)
);

create index if not exists project_agreements_client_created_idx
  on public.project_agreements (client_id, created_at desc);
create index if not exists project_agreements_project_created_idx
  on public.project_agreements (project_id, created_at desc);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique
    check (char_length(btrim(invoice_number)) between 1 and 80),
  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid not null,
  proposal_id uuid,
  agreement_id uuid,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'viewed', 'pending', 'paid', 'overdue', 'cancelled', 'refunded')),
  issue_date date not null,
  due_date date not null,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  tax numeric(12, 2) not null default 0 check (tax >= 0),
  total numeric(12, 2) not null check (total >= 0),
  notes text not null default '',
  payment_instructions text not null default '',
  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_client_project_fkey
    foreign key (project_id, client_id)
    references public.client_projects (id, client_id) on delete restrict,
  constraint invoices_proposal_fkey
    foreign key (proposal_id, client_id, project_id)
    references public.project_proposals (id, client_id, project_id) on delete restrict,
  constraint invoices_agreement_fkey
    foreign key (agreement_id, client_id, project_id)
    references public.project_agreements (id, client_id, project_id) on delete restrict,
  constraint invoices_id_client_key unique (id, client_id),
  constraint invoices_date_order check (due_date >= issue_date),
  constraint invoices_total_formula_check check (total = subtotal - discount + tax),
  constraint invoices_discount_limit_check check (discount <= subtotal),
  constraint invoices_paid_state check (status not in ('paid', 'refunded') or paid_at is not null)
);

create index if not exists invoices_client_created_idx
  on public.invoices (client_id, created_at desc);
create index if not exists invoices_project_created_idx
  on public.invoices (project_id, created_at desc);
create index if not exists invoices_due_status_idx
  on public.invoices (due_date)
  where status in ('sent', 'viewed', 'pending', 'overdue');

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  client_id uuid not null,
  position integer not null check (position >= 0),
  description text not null check (char_length(btrim(description)) between 1 and 500),
  quantity numeric(10, 2) not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(14, 2)
    generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default now(),
  constraint invoice_line_items_invoice_client_fkey
    foreign key (invoice_id, client_id)
    references public.invoices (id, client_id) on delete restrict,
  constraint invoice_line_items_invoice_position_key
    unique (invoice_id, position)
);

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  client_id uuid not null,
  provider text not null check (char_length(btrim(provider)) between 1 and 80),
  provider_transaction_id text,
  idempotency_key text not null unique
    check (char_length(btrim(idempotency_key)) between 1 and 200),
  amount numeric(12, 2) not null check (amount > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'processing', 'paid', 'failed', 'cancelled', 'refunded')),
  payment_method text,
  provider_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(provider_metadata) = 'object'),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint invoice_payments_invoice_client_fkey
    foreign key (invoice_id, client_id)
    references public.invoices (id, client_id) on delete restrict,
  constraint invoice_payments_provider_transaction_value
    check (provider_transaction_id is null or char_length(btrim(provider_transaction_id)) > 0),
  constraint invoice_payments_verified_terminal_state
    check (
      status not in ('paid', 'refunded')
      or (provider_transaction_id is not null and completed_at is not null)
    )
);

create unique index if not exists invoice_payments_provider_transaction_idx
  on public.invoice_payments (provider, provider_transaction_id)
  where provider_transaction_id is not null;
create index if not exists invoice_payments_invoice_created_idx
  on public.invoice_payments (invoice_id, created_at desc);
create index if not exists invoice_payments_client_created_idx
  on public.invoice_payments (client_id, created_at desc);

alter table public.project_proposals enable row level security;
alter table public.project_agreements enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.invoice_payments enable row level security;

revoke all on public.project_proposals, public.project_agreements, public.invoices,
  public.invoice_line_items, public.invoice_payments
  from public, anon, authenticated;
grant select, insert, update, delete on public.project_proposals,
  public.project_agreements, public.invoices, public.invoice_line_items,
  public.invoice_payments to service_role;
