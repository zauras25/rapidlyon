create table if not exists public.discovery_submissions (
  id uuid primary key default gen_random_uuid(),
  submission_key uuid not null unique,
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254),
  company text not null check (char_length(company) between 1 and 160),
  services jsonb not null check (jsonb_typeof(services) = 'array'),
  discovery_method text not null check (
    discovery_method in (
      'Self-guided discovery',
      'Discovery interview',
      'Live demo or product walkthrough'
    )
  ),
  preferred_times text,
  submission jsonb not null check (jsonb_typeof(submission) = 'object'),
  attachment_paths jsonb not null default '[]'::jsonb check (jsonb_typeof(attachment_paths) = 'array'),
  status text not null default 'New' check (
    status in (
      'New',
      'In Review',
      'Awaiting Client Information',
      'Meeting Requested',
      'Discovery Completed',
      'Proposal In Progress',
      'Closed'
    )
  ),
  internal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discovery_submissions_created_at_idx
  on public.discovery_submissions (created_at desc);
create index if not exists discovery_submissions_status_created_at_idx
  on public.discovery_submissions (status, created_at desc);

alter table public.discovery_submissions enable row level security;
revoke all on public.discovery_submissions from anon, authenticated;
grant select, insert, update on public.discovery_submissions to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'discovery-attachments',
  'discovery-attachments',
  false,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
