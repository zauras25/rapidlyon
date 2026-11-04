alter table public.invoices
  add column if not exists installment_sequence smallint,
  add column if not exists installment_stage text;

alter table public.invoices
  drop constraint if exists invoices_installment_pair_check;
alter table public.invoices
  add constraint invoices_installment_pair_check
  check (
    (installment_sequence is null and installment_stage is null)
    or (installment_sequence = 1 and installment_stage = 'advance')
    or (installment_sequence = 2 and installment_stage = 'agreed_milestone')
    or (installment_sequence = 3 and installment_stage = 'final')
  );

create unique index if not exists invoices_agreement_installment_unique_idx
  on public.invoices (agreement_id, installment_sequence)
  where agreement_id is not null and installment_sequence is not null;

create table if not exists public.commercial_financial_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'agreement_accepted',
    'installment_invoice_issued',
    'payment_attempt_created',
    'payment_status_changed'
  )),
  client_id uuid not null references public.clients(id) on delete restrict,
  agreement_id uuid references public.project_agreements(id) on delete restrict,
  invoice_id uuid references public.invoices(id) on delete restrict,
  payment_id uuid references public.invoice_payments(id) on delete restrict,
  installment_sequence smallint,
  amount numeric(12, 2) not null check (amount >= 0),
  currency char(3) not null check (currency in ('USD', 'PKR')),
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  constraint commercial_financial_events_installment_check
    check (installment_sequence is null or installment_sequence between 1 and 3)
);

alter table public.commercial_financial_events enable row level security;
revoke all on public.commercial_financial_events from public, anon, authenticated;
grant select, insert on public.commercial_financial_events to service_role;

create or replace function public.issue_agreement_installment_invoice(
  p_agreement_id uuid,
  p_sequence smallint,
  p_milestone_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_project_id uuid;
  v_proposal_id uuid;
  v_snapshot jsonb;
  v_schedule jsonb;
  v_installment jsonb;
  v_amount numeric(12, 2);
  v_currency text;
  v_label text;
  v_due_trigger text;
  v_agreed_position integer;
  v_agreed_title text;
  v_milestone record;
  v_invoice_id uuid;
begin
  if p_sequence not in (1, 2, 3) then
    raise exception 'invalid_installment_sequence';
  end if;

  select agreement.client_id, agreement.project_id, agreement.proposal_id,
         proposal.accepted_snapshot
    into v_client_id, v_project_id, v_proposal_id, v_snapshot
  from public.project_agreements agreement
  join public.project_proposals proposal
    on proposal.id = agreement.proposal_id
   and proposal.client_id = agreement.client_id
   and proposal.project_id = agreement.project_id
  where agreement.id = p_agreement_id
    and agreement.status = 'accepted'
    and proposal.status = 'accepted'
    and proposal.accepted_snapshot is not null;

  if not found or pg_catalog.jsonb_typeof(v_snapshot->'payment_schedule') <> 'array'
    or pg_catalog.jsonb_array_length(v_snapshot->'payment_schedule') <> 3
  then
    raise exception 'accepted_contract_snapshot_unavailable';
  end if;

  v_schedule := v_snapshot->'payment_schedule';
  v_installment := v_schedule->(p_sequence - 1);
  v_amount := (v_installment->>'amount')::numeric(12, 2);
  v_currency := pg_catalog.btrim(v_installment->>'currency');
  v_label := case p_sequence
    when 1 then 'Advance payment'
    when 2 then 'Agreed milestone payment'
    else 'Final payment'
  end;
  v_due_trigger := case p_sequence
    when 1 then 'After agreement acceptance and before project kickoff.'
    when 2 then 'After approval of the agreed project milestone.'
    else 'After final milestone approval and before handover.'
  end;

  if v_amount <= 0 or v_currency not in ('USD', 'PKR') then
    raise exception 'accepted_installment_invalid';
  end if;

  if p_sequence = 1 and p_milestone_id is not null then
    raise exception 'unexpected_installment_milestone';
  elsif p_sequence in (2, 3) then
    select milestone.id, milestone.project_id, milestone.title, milestone.position,
           milestone.status
      into v_milestone
    from public.project_milestones milestone
    where milestone.id = p_milestone_id
      and milestone.project_id = v_project_id;

    if not found or v_milestone.status not in ('approved', 'completed') then
      raise exception 'installment_milestone_not_approved';
    end if;

    if p_sequence = 2 then
      if coalesce(v_installment->>'milestone_position', '') !~ '^[1-9][0-9]{0,1}$' then
        raise exception 'agreed_milestone_position_invalid';
      end if;
      v_agreed_position := (v_installment->>'milestone_position')::integer;
      if pg_catalog.jsonb_typeof(v_snapshot->'milestones') <> 'array'
        or v_agreed_position > pg_catalog.jsonb_array_length(v_snapshot->'milestones')
      then
        raise exception 'agreed_milestone_position_invalid';
      end if;
      v_agreed_title := v_snapshot->'milestones'->(v_agreed_position - 1)->>'title';
      if v_milestone.position <> v_agreed_position - 1
        or v_milestone.title is distinct from v_agreed_title
      then
        raise exception 'agreed_milestone_mismatch';
      end if;
    else
      if not exists (
        select 1
        from public.invoices invoice
        where invoice.agreement_id = p_agreement_id
          and invoice.installment_sequence = 2
      ) or exists (
        select 1
        from public.project_milestones milestone
        where milestone.project_id = v_project_id
          and milestone.status not in ('approved', 'completed')
      ) or v_milestone.position <> (
        select max(milestone.position)
        from public.project_milestones milestone
        where milestone.project_id = v_project_id
      ) then
        raise exception 'final_installment_trigger_not_available';
      end if;
    end if;
  end if;

  select invoice.id into v_invoice_id
  from public.invoices invoice
  where invoice.agreement_id = p_agreement_id
    and invoice.installment_sequence = p_sequence;
  if found then
    return v_invoice_id;
  end if;

  insert into public.invoices (
    invoice_number, client_id, project_id, proposal_id, agreement_id,
    installment_sequence, installment_stage, status, issue_date, due_date,
    currency, subtotal, discount, tax, total, notes, payment_instructions,
    sent_at
  ) values (
    'RAP-INV-PENDING', v_client_id, v_project_id, v_proposal_id, p_agreement_id,
    p_sequence, case p_sequence when 1 then 'advance' when 2 then 'agreed_milestone' else 'final' end,
    'sent', current_date, current_date + 14,
    v_currency, v_amount, 0, 0, v_amount, v_label || '. ' || v_due_trigger,
    'Contact Rapidlyon to arrange payment until online checkout is enabled.',
    pg_catalog.now()
  )
  on conflict (agreement_id, installment_sequence)
    where agreement_id is not null and installment_sequence is not null
    do nothing
  returning id into v_invoice_id;

  if v_invoice_id is null then
    select invoice.id into v_invoice_id
    from public.invoices invoice
    where invoice.agreement_id = p_agreement_id
      and invoice.installment_sequence = p_sequence;
    if v_invoice_id is null then
      raise exception 'installment_invoice_creation_failed';
    end if;
    return v_invoice_id;
  end if;

  insert into public.invoice_line_items (
    invoice_id, client_id, position, description, quantity, unit_price
  ) values (
    v_invoice_id, v_client_id, 0, v_label, 1, v_amount
  );

  insert into public.commercial_financial_events (
    event_type, client_id, agreement_id, invoice_id, installment_sequence,
    amount, currency, details
  ) values (
    'installment_invoice_issued', v_client_id, p_agreement_id, v_invoice_id,
    p_sequence, v_amount, v_currency,
    pg_catalog.jsonb_build_object(
      'proposal_id', v_proposal_id,
      'milestone_id', p_milestone_id,
      'invoice_stage', v_installment->>'stage',
      'trigger', v_due_trigger
    )
  );

  return v_invoice_id;
end;
$$;

revoke all on function public.issue_agreement_installment_invoice(uuid, smallint, uuid)
  from public, anon, authenticated;
grant execute on function public.issue_agreement_installment_invoice(uuid, smallint, uuid)
  to service_role;

create or replace function public.record_agreement_acceptance_and_issue_advance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot jsonb;
begin
  select proposal.accepted_snapshot
    into v_snapshot
  from public.project_proposals proposal
  where proposal.id = new.proposal_id
    and proposal.client_id = new.client_id
    and proposal.project_id = new.project_id
    and proposal.status = 'accepted'
    and proposal.accepted_snapshot is not null;

  if not found then
    raise exception 'accepted_proposal_snapshot_required';
  end if;

  insert into public.commercial_financial_events (
    event_type, client_id, agreement_id, amount, currency, details
  ) values (
    'agreement_accepted', new.client_id, new.id,
    (v_snapshot->>'amount')::numeric(12, 2),
    pg_catalog.btrim(v_snapshot->>'currency'),
    pg_catalog.jsonb_build_object(
      'accepted_by_auth_user_id', new.accepted_by_auth_user_id,
      'accepted_at', new.accepted_at,
      'proposal_id', new.proposal_id,
      'version', new.version
    )
  );

  perform public.issue_agreement_installment_invoice(new.id, 1, null);
  return new;
end;
$$;

revoke all on function public.record_agreement_acceptance_and_issue_advance()
  from public, anon, authenticated;

drop trigger if exists commercial_agreement_acceptance_invoice on public.project_agreements;
create trigger commercial_agreement_acceptance_invoice
after update of status on public.project_agreements
for each row
when (new.status = 'accepted' and old.status is distinct from new.status)
execute function public.record_agreement_acceptance_and_issue_advance();

create or replace function public.issue_milestone_installment_invoices()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agreement_id uuid;
  v_snapshot jsonb;
  v_installment jsonb;
  v_milestone_position integer;
  v_expected_title text;
  v_sequence_two_invoice uuid;
  v_final_milestone_id uuid;
begin
  if new.status not in ('approved', 'completed') then
    return new;
  end if;

  select agreement.id, proposal.accepted_snapshot
    into v_agreement_id, v_snapshot
  from public.project_agreements agreement
  join public.project_proposals proposal
    on proposal.id = agreement.proposal_id
   and proposal.client_id = agreement.client_id
   and proposal.project_id = agreement.project_id
  where agreement.project_id = new.project_id
    and agreement.status = 'accepted'
    and proposal.status = 'accepted'
    and proposal.accepted_snapshot is not null
  order by agreement.version desc, agreement.accepted_at desc
  limit 1;

  if not found then
    return new;
  end if;

  v_installment := v_snapshot->'payment_schedule'->1;
  if coalesce(v_installment->>'milestone_position', '') ~ '^[1-9][0-9]{0,1}$' then
    v_milestone_position := (v_installment->>'milestone_position')::integer;
    if pg_catalog.jsonb_typeof(v_snapshot->'milestones') = 'array'
      and v_milestone_position <= pg_catalog.jsonb_array_length(v_snapshot->'milestones')
    then
      v_expected_title := v_snapshot->'milestones'->(v_milestone_position - 1)->>'title';
      if new.position = v_milestone_position - 1
        and new.title is not distinct from v_expected_title
      then
        perform public.issue_agreement_installment_invoice(
          v_agreement_id,
          2,
          new.id
        );
      end if;
    end if;
  end if;

  select invoice.id into v_sequence_two_invoice
  from public.invoices invoice
  where invoice.agreement_id = v_agreement_id
    and invoice.installment_sequence = 2;

  select milestone.id into v_final_milestone_id
  from public.project_milestones milestone
  where milestone.project_id = new.project_id
  order by milestone.position desc
  limit 1;

  if v_sequence_two_invoice is not null
    and v_final_milestone_id is not null
    and not exists (
      select 1
      from public.project_milestones milestone
      where milestone.project_id = new.project_id
        and milestone.status not in ('approved', 'completed')
    )
  then
    perform public.issue_agreement_installment_invoice(
      v_agreement_id,
      3,
      v_final_milestone_id
    );
  end if;

  return new;
end;
$$;

revoke all on function public.issue_milestone_installment_invoices()
  from public, anon, authenticated;

drop trigger if exists commercial_milestone_installment_invoices on public.project_milestones;
create trigger commercial_milestone_installment_invoices
after update of status on public.project_milestones
for each row
when (new.status in ('approved', 'completed'))
execute function public.issue_milestone_installment_invoices();

create or replace function public.check_contract_installment_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract_total numeric(12, 2);
  v_installment_total numeric(12, 2);
  v_count integer;
  v_currency_count integer;
begin
  if new.installment_sequence <> 3 then
    return new;
  end if;

  select (proposal.accepted_snapshot->>'amount')::numeric(12, 2)
    into v_contract_total
  from public.project_agreements agreement
  join public.project_proposals proposal
    on proposal.id = agreement.proposal_id
   and proposal.client_id = agreement.client_id
   and proposal.project_id = agreement.project_id
  where agreement.id = new.agreement_id
    and proposal.accepted_snapshot is not null;

  select count(*), coalesce(sum(invoice.total), 0), count(distinct invoice.currency)
    into v_count, v_installment_total, v_currency_count
  from public.invoices invoice
  where invoice.agreement_id = new.agreement_id
    and invoice.installment_sequence between 1 and 3;

  if v_count <> 3 or v_installment_total <> v_contract_total or v_currency_count <> 1
    or exists (
      select 1
      from public.invoices invoice
      where invoice.agreement_id = new.agreement_id
        and invoice.installment_sequence between 1 and 3
        and invoice.currency <> new.currency
    )
  then
    raise exception 'contract_installment_total_mismatch';
  end if;
  return new;
end;
$$;

revoke all on function public.check_contract_installment_total()
  from public, anon, authenticated;

drop trigger if exists contract_installment_total_check on public.invoices;
create constraint trigger contract_installment_total_check
after insert or update on public.invoices
deferrable initially deferred
for each row
when (new.installment_sequence = 3)
execute function public.check_contract_installment_total();

create or replace function public.prevent_issued_installment_edits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.installment_sequence is not null and (
    new.invoice_number is distinct from old.invoice_number
    or new.client_id is distinct from old.client_id
    or new.project_id is distinct from old.project_id
    or new.proposal_id is distinct from old.proposal_id
    or new.agreement_id is distinct from old.agreement_id
    or new.installment_sequence is distinct from old.installment_sequence
    or new.installment_stage is distinct from old.installment_stage
    or new.issue_date is distinct from old.issue_date
    or new.due_date is distinct from old.due_date
    or new.currency is distinct from old.currency
    or new.subtotal is distinct from old.subtotal
    or new.discount is distinct from old.discount
    or new.tax is distinct from old.tax
    or new.total is distinct from old.total
  ) then
    raise exception 'issued_contract_installment_is_immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_issued_installment_edits()
  from public, anon, authenticated;

drop trigger if exists issued_installment_immutable on public.invoices;
create trigger issued_installment_immutable
before update on public.invoices
for each row
execute function public.prevent_issued_installment_edits();

create or replace function public.accept_project_agreement(p_agreement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  update public.project_agreements agreement
    set status = 'accepted',
        accepted_at = pg_catalog.now(),
        accepted_by_auth_user_id = auth.uid(),
        updated_at = pg_catalog.now()
    from public.clients client
    where agreement.id = p_agreement_id
      and client.id = agreement.client_id
      and client.auth_user_id = auth.uid()
      and client.status = 'active'
      and exists (
        select 1
        from auth.users auth_user
        where auth_user.id = auth.uid()
          and coalesce(auth_user.email_confirmed_at, auth_user.confirmed_at) is not null
      )
      and agreement.status = 'sent'
      and exists (
        select 1
        from public.project_proposals proposal
        where proposal.id = agreement.proposal_id
          and proposal.client_id = agreement.client_id
          and proposal.project_id = agreement.project_id
          and proposal.status = 'accepted'
          and proposal.accepted_snapshot is not null
      )
    returning pg_catalog.jsonb_build_object(
      'agreement_id', agreement.id,
      'client_id', agreement.client_id,
      'project_id', agreement.project_id,
      'proposal_id', agreement.proposal_id,
      'accepted_at', agreement.accepted_at,
      'accepted_by_auth_user_id', agreement.accepted_by_auth_user_id,
      'version', agreement.version
    ) into v_result;

  if v_result is null then
    raise exception 'agreement_not_available';
  end if;
  return v_result;
end;
$$;

revoke all on function public.accept_project_agreement(uuid) from public, anon;
grant execute on function public.accept_project_agreement(uuid) to authenticated;
