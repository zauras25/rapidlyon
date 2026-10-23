create table if not exists public.commercial_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (char_length(btrim(provider)) between 1 and 80),
  provider_event_id text not null check (char_length(btrim(provider_event_id)) between 1 and 200),
  event_type text not null check (char_length(btrim(event_type)) between 1 and 120),
  processed_at timestamptz not null default now(),
  constraint commercial_webhook_events_provider_event_key
    unique (provider, provider_event_id)
);

alter table public.commercial_webhook_events enable row level security;
revoke all on public.commercial_webhook_events from public, anon, authenticated;
grant select, insert, update, delete on public.commercial_webhook_events to service_role;

create or replace function public.accept_project_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_project_id uuid;
  v_status text;
  v_accepted_at timestamptz;
begin
  select c.id, pp.project_id, pp.status
    into v_client_id, v_project_id, v_status
  from public.clients c
  join public.project_proposals pp on pp.client_id = c.id
  where c.auth_user_id = auth.uid()
    and c.status = 'active'
    and pp.id = p_proposal_id
  for update of pp;

  if not found then
    raise exception 'proposal_not_found';
  end if;
  if v_status not in ('sent', 'viewed') then
    raise exception 'proposal_not_available';
  end if;

  v_accepted_at := pg_catalog.now();
  update public.project_proposals
    set status = 'accepted', accepted_at = v_accepted_at, updated_at = v_accepted_at
    where id = p_proposal_id;

  return pg_catalog.jsonb_build_object(
    'proposal_id', p_proposal_id,
    'client_id', v_client_id,
    'project_id', v_project_id,
    'accepted_at', v_accepted_at
  );
end;
$$;

create or replace function public.decline_project_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_project_id uuid;
  v_status text;
  v_declined_at timestamptz;
begin
  select c.id, pp.project_id, pp.status
    into v_client_id, v_project_id, v_status
  from public.clients c
  join public.project_proposals pp on pp.client_id = c.id
  where c.auth_user_id = auth.uid()
    and c.status = 'active'
    and pp.id = p_proposal_id
  for update of pp;

  if not found then
    raise exception 'proposal_not_found';
  end if;
  if v_status not in ('sent', 'viewed') then
    raise exception 'proposal_not_available';
  end if;

  v_declined_at := pg_catalog.now();
  update public.project_proposals
    set status = 'declined', declined_at = v_declined_at, updated_at = v_declined_at
    where id = p_proposal_id;

  return pg_catalog.jsonb_build_object(
    'proposal_id', p_proposal_id,
    'client_id', v_client_id,
    'project_id', v_project_id,
    'declined_at', v_declined_at
  );
end;
$$;

create or replace function public.accept_project_agreement(p_agreement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  update public.project_agreements pa
    set status = 'accepted',
        accepted_at = pg_catalog.now(),
        accepted_by_auth_user_id = auth.uid(),
        updated_at = pg_catalog.now()
    from public.clients c
    where pa.id = p_agreement_id
      and c.id = pa.client_id
      and c.auth_user_id = auth.uid()
      and c.status = 'active'
      and pa.status = 'sent'
    returning pg_catalog.jsonb_build_object(
      'agreement_id', pa.id,
      'client_id', pa.client_id,
      'project_id', pa.project_id,
      'proposal_id', pa.proposal_id,
      'accepted_at', pa.accepted_at,
      'version', pa.version
    ) into v_result;

  if v_result is null then
    raise exception 'agreement_not_available';
  end if;
  return v_result;
end;
$$;

create or replace function public.create_admin_commercial_record(
  p_kind text,
  p_record jsonb,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid := (p_record->>'client_id')::uuid;
  v_project_id uuid := (p_record->>'project_id')::uuid;
  v_row jsonb;
  v_invoice_id uuid;
  v_subtotal numeric(12,2);
  v_discount numeric(12,2) := coalesce((p_record->>'discount')::numeric, 0);
  v_tax numeric(12,2) := coalesce((p_record->>'tax')::numeric, 0);
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if jsonb_typeof(p_record) <> 'object' or jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid_commercial_record';
  end if;

  if p_kind = 'proposal' then
    insert into public.project_proposals (
      proposal_number, client_id, project_id, title, summary, scope,
      deliverables, exclusions, timeline, milestones, payment_schedule,
      amount, currency, notes, status, expires_at
    ) values (
      p_record->>'proposal_number', v_client_id, v_project_id,
      p_record->>'title', coalesce(p_record->>'summary', ''),
      coalesce(p_record->'scope', '{}'::jsonb),
      coalesce(p_record->'deliverables', '[]'::jsonb),
      coalesce(p_record->'exclusions', '[]'::jsonb),
      coalesce(p_record->'timeline', '{}'::jsonb),
      coalesce(p_record->'milestones', '[]'::jsonb),
      coalesce(p_record->'payment_schedule', '[]'::jsonb),
      (p_record->>'amount')::numeric,
      p_record->>'currency',
      coalesce(p_record->>'notes', ''),
      'draft',
      nullif(p_record->>'expires_at', '')::timestamptz
    ) returning pg_catalog.to_jsonb(project_proposals.*) into v_row;
  elsif p_kind = 'agreement' then
    if not exists (
      select 1 from public.project_proposals pp
      where pp.id = (p_record->>'proposal_id')::uuid
        and pp.client_id = v_client_id
        and pp.project_id = v_project_id
        and pp.status = 'accepted'
    ) then
      raise exception 'proposal_must_be_accepted';
    end if;
    insert into public.project_agreements (
      client_id, project_id, proposal_id, version, terms, status
    ) values (
      v_client_id, v_project_id, (p_record->>'proposal_id')::uuid,
      (p_record->>'version')::integer, p_record->>'terms', 'draft'
    ) returning pg_catalog.to_jsonb(project_agreements.*) into v_row;
  elsif p_kind = 'invoice' then
    if jsonb_array_length(p_items) = 0 then
      raise exception 'invoice_requires_line_items';
    end if;
    select coalesce(sum(round((item->>'quantity')::numeric * (item->>'unit_price')::numeric, 2)), 0)
      into v_subtotal
      from jsonb_array_elements(p_items) as item;
    if v_discount < 0 or v_discount > v_subtotal or v_tax < 0 then
      raise exception 'invalid_invoice_totals';
    end if;

    insert into public.invoices (
      invoice_number, client_id, project_id, proposal_id, agreement_id,
      status, issue_date, due_date, currency, subtotal, discount, tax,
      total, notes, payment_instructions
    ) values (
      p_record->>'invoice_number', v_client_id, v_project_id,
      nullif(p_record->>'proposal_id', '')::uuid,
      nullif(p_record->>'agreement_id', '')::uuid,
      'draft', (p_record->>'issue_date')::date, (p_record->>'due_date')::date,
      p_record->>'currency', v_subtotal, v_discount, v_tax,
      v_subtotal - v_discount + v_tax,
      coalesce(p_record->>'notes', ''),
      coalesce(p_record->>'payment_instructions', '')
    ) returning id into v_invoice_id;

    insert into public.invoice_line_items (
      invoice_id, client_id, position, description, quantity, unit_price
    )
    select
      v_invoice_id, v_client_id, (item->>'position')::integer,
      item->>'description', (item->>'quantity')::numeric,
      (item->>'unit_price')::numeric
    from jsonb_array_elements(p_items) as item;

    select pg_catalog.to_jsonb(i.*) into v_row
      from public.invoices i where i.id = v_invoice_id;
  else
    raise exception 'unsupported_commercial_record';
  end if;

  return v_row;
end;
$$;

create or replace function public.update_admin_commercial_draft(
  p_kind text,
  p_id uuid,
  p_record jsonb,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_subtotal numeric(12,2);
  v_discount numeric(12,2) := coalesce((p_record->>'discount')::numeric, 0);
  v_tax numeric(12,2) := coalesce((p_record->>'tax')::numeric, 0);
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if jsonb_typeof(p_record) <> 'object' or jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid_commercial_record';
  end if;

  if p_kind = 'proposal' then
    update public.project_proposals
      set proposal_number = p_record->>'proposal_number',
          title = p_record->>'title',
          summary = coalesce(p_record->>'summary', ''),
          scope = coalesce(p_record->'scope', '{}'::jsonb),
          deliverables = coalesce(p_record->'deliverables', '[]'::jsonb),
          exclusions = coalesce(p_record->'exclusions', '[]'::jsonb),
          timeline = coalesce(p_record->'timeline', '{}'::jsonb),
          milestones = coalesce(p_record->'milestones', '[]'::jsonb),
          payment_schedule = coalesce(p_record->'payment_schedule', '[]'::jsonb),
          amount = (p_record->>'amount')::numeric,
          currency = p_record->>'currency',
          notes = coalesce(p_record->>'notes', ''),
          expires_at = nullif(p_record->>'expires_at', '')::timestamptz,
          updated_at = pg_catalog.now()
      where id = p_id and status = 'draft'
      returning pg_catalog.to_jsonb(project_proposals.*) into v_row;
  elsif p_kind = 'agreement' then
    update public.project_agreements
      set terms = p_record->>'terms',
          version = (p_record->>'version')::integer,
          updated_at = pg_catalog.now()
      where id = p_id and status = 'draft'
      returning pg_catalog.to_jsonb(project_agreements.*) into v_row;
  elsif p_kind = 'invoice' then
    if jsonb_array_length(p_items) = 0 then
      raise exception 'invoice_requires_line_items';
    end if;
    select coalesce(sum(round((item->>'quantity')::numeric * (item->>'unit_price')::numeric, 2)), 0)
      into v_subtotal
      from jsonb_array_elements(p_items) as item;
    if v_discount < 0 or v_discount > v_subtotal or v_tax < 0 then
      raise exception 'invalid_invoice_totals';
    end if;
    update public.invoices
      set invoice_number = p_record->>'invoice_number',
          issue_date = (p_record->>'issue_date')::date,
          due_date = (p_record->>'due_date')::date,
          currency = p_record->>'currency',
          subtotal = v_subtotal,
          discount = v_discount,
          tax = v_tax,
          total = v_subtotal - v_discount + v_tax,
          notes = coalesce(p_record->>'notes', ''),
          payment_instructions = coalesce(p_record->>'payment_instructions', ''),
          updated_at = pg_catalog.now()
      where id = p_id and status = 'draft'
      returning pg_catalog.to_jsonb(invoices.*) into v_row;
    if v_row is not null then
      delete from public.invoice_line_items where invoice_id = p_id;
      insert into public.invoice_line_items (
        invoice_id, client_id, position, description, quantity, unit_price
      )
      select
        p_id, (v_row->>'client_id')::uuid, (item->>'position')::integer,
        item->>'description', (item->>'quantity')::numeric,
        (item->>'unit_price')::numeric
      from jsonb_array_elements(p_items) as item;
    end if;
  else
    raise exception 'unsupported_commercial_record';
  end if;

  if v_row is null then
    raise exception 'commercial_draft_not_available';
  end if;
  return v_row;
end;
$$;

create or replace function public.transition_admin_commercial_record(
  p_kind text,
  p_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_now timestamptz := pg_catalog.now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_kind = 'proposal' and p_action in ('send', 'expire') then
    update public.project_proposals
      set status = case when p_action = 'send' then 'sent' else 'expired' end,
          sent_at = case when p_action = 'send' then v_now else sent_at end,
          updated_at = v_now
      where id = p_id
        and ((p_action = 'send' and status = 'draft')
          or (p_action = 'expire' and status in ('sent', 'viewed')))
      returning pg_catalog.to_jsonb(project_proposals.*) into v_row;
  elsif p_kind = 'agreement' and p_action = 'send' then
    update public.project_agreements
      set status = 'sent', sent_at = v_now, updated_at = v_now
      where id = p_id and status = 'draft'
        and exists (
          select 1 from public.project_proposals pp
          where pp.id = project_agreements.proposal_id
            and pp.status = 'accepted'
        )
      returning pg_catalog.to_jsonb(project_agreements.*) into v_row;
  elsif p_kind = 'invoice' and p_action = 'send' then
    update public.invoices
      set status = 'sent', sent_at = v_now, updated_at = v_now
      where id = p_id and status = 'draft'
        and exists (
          select 1 from public.invoice_line_items li
          where li.invoice_id = invoices.id
        )
      returning pg_catalog.to_jsonb(invoices.*) into v_row;
  else
    raise exception 'unsupported_commercial_transition';
  end if;

  if v_row is null then
    raise exception 'commercial_transition_not_available';
  end if;
  return v_row;
end;
$$;

create or replace function public.process_commercial_payment_event(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_payment_id uuid,
  p_transaction_id text,
  p_status text,
  p_payment_method text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.invoice_payments%rowtype;
  v_event_id uuid;
  v_invoice_status text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_status not in ('processing', 'paid', 'failed', 'cancelled', 'refunded') then
    raise exception 'invalid_payment_status';
  end if;
  if p_status in ('paid', 'refunded') and nullif(pg_catalog.btrim(p_transaction_id), '') is null then
    raise exception 'verified_transaction_required';
  end if;

  insert into public.commercial_webhook_events (provider, provider_event_id, event_type)
    values (p_provider, p_event_id, p_event_type)
    on conflict (provider, provider_event_id) do nothing
    returning id into v_event_id;
  if v_event_id is null then
    return pg_catalog.jsonb_build_object('duplicate', true);
  end if;

  select * into v_payment
    from public.invoice_payments
    where id = p_payment_id and provider = p_provider
    for update;
  if not found then
    delete from public.commercial_webhook_events where id = v_event_id;
    raise exception 'payment_not_found';
  end if;

  if v_payment.status in ('paid', 'refunded') and p_status not in ('paid', 'refunded') then
    delete from public.commercial_webhook_events where id = v_event_id;
    raise exception 'invalid_payment_transition';
  end if;

  update public.invoice_payments
    set status = p_status,
        provider_transaction_id = coalesce(nullif(pg_catalog.btrim(p_transaction_id), ''), provider_transaction_id),
        payment_method = coalesce(nullif(p_payment_method, ''), payment_method),
        completed_at = case when p_status in ('paid', 'refunded') then pg_catalog.now() else completed_at end
    where id = p_payment_id;

  if p_status = 'paid' then
    update public.invoices
      set status = 'paid', paid_at = pg_catalog.now(), updated_at = pg_catalog.now()
      where id = v_payment.invoice_id
      returning status into v_invoice_status;
  elsif p_status = 'refunded' then
    update public.invoices
      set status = 'refunded', updated_at = pg_catalog.now()
      where id = v_payment.invoice_id
      returning status into v_invoice_status;
  elsif p_status = 'failed' and v_payment.status in ('awaiting_payment', 'processing') then
    update public.invoices
      set status = 'sent', updated_at = pg_catalog.now()
      where id = v_payment.invoice_id and status = 'pending'
      returning status into v_invoice_status;
  end if;

  return pg_catalog.jsonb_build_object(
    'duplicate', false,
    'payment_id', p_payment_id,
    'invoice_id', v_payment.invoice_id,
    'client_id', v_payment.client_id,
    'status', p_status,
    'transaction_id', p_transaction_id
  );
end;
$$;

revoke all on function public.accept_project_proposal(uuid) from public, anon;
revoke all on function public.decline_project_proposal(uuid) from public, anon;
revoke all on function public.accept_project_agreement(uuid) from public, anon;
revoke all on function public.create_admin_commercial_record(text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.update_admin_commercial_draft(text, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.transition_admin_commercial_record(text, uuid, text) from public, anon, authenticated;
revoke all on function public.process_commercial_payment_event(text, text, text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.accept_project_proposal(uuid) to authenticated;
grant execute on function public.decline_project_proposal(uuid) to authenticated;
grant execute on function public.accept_project_agreement(uuid) to authenticated;
grant execute on function public.create_admin_commercial_record(text, jsonb, jsonb) to service_role;
grant execute on function public.update_admin_commercial_draft(text, uuid, jsonb, jsonb) to service_role;
grant execute on function public.transition_admin_commercial_record(text, uuid, text) to service_role;
grant execute on function public.process_commercial_payment_event(text, text, text, uuid, text, text, text) to service_role;