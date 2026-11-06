alter table public.discovery_submissions
  add column if not exists notification_status text not null default 'pending'
    check (notification_status in ('pending', 'sending', 'sent', 'failed')),
  add column if not exists notification_updated_at timestamptz;
