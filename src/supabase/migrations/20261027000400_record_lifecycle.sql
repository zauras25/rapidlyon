-- Apply after 20261027000300_inquiry_messages.sql, record history migration.
-- No existing rows removed. Archive is reversible.
alter table public.inquiries add column if not exists archived_at timestamptz;
alter table public.discovery_submissions add column if not exists archived_at timestamptz;
create index if not exists inquiries_archived_created_idx on public.inquiries(archived_at, created_at desc);
create index if not exists discovery_archived_created_idx on public.discovery_submissions(archived_at, created_at desc);
alter table public.inquiry_messages add column if not exists provider_email_id text;
create unique index if not exists inquiry_messages_provider_email_id_unique on public.inquiry_messages(provider_email_id);
-- Atomic delete: dependent inquiry messages removed in same transaction.
-- Not exposed to anon/authenticated; only service-role API may call.
create or replace function public.purge_admin_inquiry(target_id uuid) returns boolean
language plpgsql security invoker set search_path = public,pg_catalog as $$
begin
  if not exists(select 1 from public.inquiries where id=target_id) then return false; end if;
  if not exists(select 1 from public.inquiries where id=target_id and archived_at is not null) then
    raise exception 'Archive the inquiry before permanent deletion';
  end if;
  delete from public.inquiry_messages where inquiry_id=target_id;
  delete from public.inquiries where id=target_id;
  return true;
end; $$;
revoke all on function public.purge_admin_inquiry(uuid) from public,anon,authenticated;
grant execute on function public.purge_admin_inquiry(uuid) to service_role;
