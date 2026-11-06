-- Apply after 20261023000100_create_inquiries.sql and 20261027000100_inquiry_workflow.sql.
create table if not exists public.inquiry_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete restrict,
  direction text not null check (direction in ('outbound', 'inbound')),
  recipient text not null,
  body text not null,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inquiry_messages_inquiry_created_idx on public.inquiry_messages(inquiry_id,created_at);
alter table public.inquiry_messages enable row level security;
revoke all on public.inquiry_messages from anon, authenticated;
grant select, insert, update on public.inquiry_messages to service_role;
-- No browser-side direct access. Admin API checks session and uses service role.
