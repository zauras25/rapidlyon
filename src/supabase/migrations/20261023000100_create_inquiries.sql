create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  service text not null,
  project_description text not null,
  budget text,
  timeline text,
  created_at timestamptz not null default now()
);

alter table public.inquiries enable row level security;
grant insert on public.inquiries to service_role;
