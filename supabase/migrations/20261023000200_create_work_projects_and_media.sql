create table if not exists public.work_projects (
  slug text primary key
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null
    check (status in ('draft', 'published', 'deleted')),
  data jsonb not null
    check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.work_projects enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work-project-media',
  'work-project-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

comment on table public.work_projects is
  'Portfolio CMS records. Anonymous access is not granted; the application reads public projects through its server-only service role.';
