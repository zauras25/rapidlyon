-- RapidlyOn unified record history. Apply after existing commercial/inquiry migrations.
-- Historical updates before installation cannot be reconstructed.
create table if not exists public.admin_record_events (
 id bigint generated always as identity primary key,
 record_type text not null,
 record_id uuid not null,
 operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
 changed_fields text[] not null default '{}'::text[],
 old_status text,
 new_status text,
 occurred_at timestamptz not null default now()
);
create index if not exists admin_record_events_recent_idx on public.admin_record_events (occurred_at desc, id desc);
create index if not exists admin_record_events_record_idx on public.admin_record_events (record_type, record_id, occurred_at desc);
alter table public.admin_record_events enable row level security;
revoke all on public.admin_record_events from public, anon, authenticated;
grant select on public.admin_record_events to service_role;
-- No frontend role can write audit records, and only trusted DB trigger may insert.
create or replace function public.capture_admin_record_event() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare old_j jsonb; new_j jsonb; keys text[]; previous_status text; next_status text;
begin
 if TG_OP = 'INSERT' then
   new_j := to_jsonb(NEW); old_j := '{}'::jsonb;
 elsif TG_OP = 'DELETE' then
   old_j := to_jsonb(OLD); new_j := '{}'::jsonb;
 else
   old_j := to_jsonb(OLD); new_j := to_jsonb(NEW);
   if old_j = new_j then return NEW; end if;
 end if;
 select coalesce(array_agg(k order by k),'{}'::text[]) into keys
 from (select jsonb_object_keys(old_j || new_j) as k) t
 where old_j->t.k is distinct from new_j->t.k;
 -- Ignore noisy updated_at-only changes.
 if TG_OP='UPDATE' and keys <@ array['updated_at']::text[] then return NEW; end if;
 previous_status := case when old_j ? 'status' then old_j->>'status' else null end;
 next_status := case when new_j ? 'status' then new_j->>'status' else null end;
 insert into public.admin_record_events(record_type,record_id,operation,changed_fields,old_status,new_status)
 values (TG_TABLE_NAME, coalesce((new_j->>'id')::uuid,(old_j->>'id')::uuid),TG_OP,keys,previous_status,next_status);
 return case when TG_OP='DELETE' then OLD else NEW end;
end; $$;
revoke all on function public.capture_admin_record_event() from public, anon, authenticated;
-- Explicit table allowlist; do not log messages, credentials, or full financial payloads.
do $$ declare table_name text; begin
 foreach table_name in array array[
  'inquiries','discovery_submissions','clients','client_projects',
  'project_proposals','project_agreements','invoices','invoice_payments',
  'project_milestones','project_deliverables','project_reviews'
 ] loop
  if to_regclass('public.' || table_name) is not null then
   execute format('drop trigger if exists trg_admin_record_history on public.%I',table_name);
   execute format('create trigger trg_admin_record_history after insert or update or delete on public.%I for each row execute function public.capture_admin_record_event()',table_name);
  end if;
 end loop;
end $$;
