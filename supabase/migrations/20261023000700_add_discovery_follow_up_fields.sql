alter table public.discovery_submissions
  add column if not exists next_action text,
  add column if not exists follow_up_at date;