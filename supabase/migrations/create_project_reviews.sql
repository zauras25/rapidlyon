create table if not exists public.project_reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  rating smallint not null check (rating between 1 and 5),
  review text not null check (char_length(review) between 20 and 1200),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.project_reviews enable row level security;
grant select, insert, update on public.project_reviews to service_role;
