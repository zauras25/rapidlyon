-- Run before deploying the admin inquiries workflow.
alter table public.inquiries
  add column if not exists status text not null default 'new',
  add column if not exists admin_notes text,
  add column if not exists follow_up_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.inquiries drop constraint if exists inquiries_status_check;
alter table public.inquiries add constraint inquiries_status_check
  check (status in ('new', 'reviewing', 'contacted', 'qualified', 'closed'));
create index if not exists inquiries_status_created_idx on public.inquiries(status, created_at desc);
-- RLS remains enabled; only server-side service role accesses this table.
