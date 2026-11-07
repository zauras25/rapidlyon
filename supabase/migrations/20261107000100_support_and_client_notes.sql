-- Decision 22/23: separate post-launch support and a client-linked note history.
-- ADDITIVE ONLY. Review on staging before applying to production.
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid references public.client_projects(id) on delete set null,
  title text not null check (char_length(trim(title)) between 3 and 200),
  description text not null check (char_length(trim(description)) between 5 and 10000),
  category text not null check (category in ('bug','maintenance','feature','help')),
  severity text not null default 'normal' check (severity in ('normal','high','critical')),
  coverage text not null default 'review' check (coverage in ('review','covered','uncovered')),
  status text not null default 'new' check (status in ('new','triage','waiting_client','quotation_required','in_progress','client_verification','resolved','closed','on_hold')),
  resolution text not null default '',
  assigned_owner text not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint support_close_has_resolution check (status <> 'closed' or (char_length(trim(resolution)) >= 5 and closed_at is not null))
);
create index if not exists support_tickets_client_created_idx on public.support_tickets(client_id, created_at desc);
create index if not exists support_tickets_status_created_idx on public.support_tickets(status, created_at desc);
alter table public.support_tickets enable row level security;
-- Zero anon/authenticated table policies. Server operations require role-guarded service role.
revoke all on public.support_tickets from anon, authenticated;

create table if not exists public.client_relationship_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  content text not null check (char_length(trim(content)) between 1 and 4000),
  created_by text not null default 'owner',
  created_at timestamptz not null default now()
);
create index if not exists client_relationship_notes_client_idx on public.client_relationship_notes(client_id, created_at desc);
alter table public.client_relationship_notes enable row level security;
revoke all on public.client_relationship_notes from anon, authenticated;

create table if not exists public.support_ticket_events (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.support_tickets(id) on delete restrict,
  event_type text not null,
  previous_status text,
  next_status text,
  note text not null default '',
  performed_by text not null default 'owner',
  occurred_at timestamptz not null default now()
);
create index if not exists support_ticket_events_ticket_idx on public.support_ticket_events(ticket_id,occurred_at desc);
alter table public.support_ticket_events enable row level security;
revoke all on public.support_ticket_events from anon, authenticated;

create or replace function public.audit_support_ticket_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.support_ticket_events(ticket_id,event_type,next_status,note)
    values(new.id,'created',new.status,'Support ticket created');
  elsif old.status is distinct from new.status or old.resolution is distinct from new.resolution then
    insert into public.support_ticket_events(ticket_id,event_type,previous_status,next_status,note)
    values(new.id,'updated',old.status,new.status,case when old.resolution is distinct from new.resolution then 'Resolution updated' else 'State updated' end);
  end if;
  return new;
end;
$$;
revoke all on function public.audit_support_ticket_change() from public, anon, authenticated;
drop trigger if exists audit_support_ticket_change on public.support_tickets;
create trigger audit_support_ticket_change after insert or update on public.support_tickets
for each row execute function public.audit_support_ticket_change();

-- Decision 30: settings are non-secret operational preferences, never gateway credentials.
create table if not exists public.admin_workspace_settings (
  setting_id text primary key default 'owner' check (setting_id = 'owner'),
  business_name text not null default 'RapidlyOn' check (char_length(trim(business_name)) between 1 and 120),
  contact_email text not null default '' check (char_length(contact_email) <= 254),
  public_website text not null default '' check (char_length(public_website) <= 500),
  display_currency text not null default 'PKR' check (display_currency in ('PKR','USD')),
  digest_frequency text not null default 'daily' check (digest_frequency in ('daily','weekly','off')),
  routine_email_alerts boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.admin_workspace_settings enable row level security;
revoke all on public.admin_workspace_settings from anon, authenticated;
insert into public.admin_workspace_settings(setting_id) values ('owner') on conflict do nothing;
