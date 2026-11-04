create or replace function public.create_invoice_payment_attempt(
  p_client_id uuid,
  p_invoice_id uuid,
  p_provider text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_payment public.invoice_payments%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[0-9a-f]{64}$'
    or p_provider is null or pg_catalog.char_length(pg_catalog.btrim(p_provider)) not between 1 and 80
  then
    raise exception 'invalid_payment_attempt_request';
  end if;

  select * into v_invoice
  from public.invoices invoice
  where invoice.id = p_invoice_id
    and invoice.client_id = p_client_id
  for update;

  if not found or v_invoice.status not in ('sent', 'viewed', 'pending')
    or v_invoice.total <= 0
  then
    raise exception 'invoice_not_payable';
  end if;

  select * into v_payment
  from public.invoice_payments payment
  where payment.idempotency_key = p_idempotency_key
    and payment.invoice_id = p_invoice_id
    and payment.client_id = p_client_id
  for update;
  if found then
    return pg_catalog.to_jsonb(v_payment);
  end if;

  select * into v_payment
  from public.invoice_payments payment
  where payment.invoice_id = p_invoice_id
    and payment.status in ('awaiting_payment', 'processing')
  order by payment.created_at desc
  limit 1
  for update;
  if found then
    raise exception 'payment_attempt_in_progress';
  end if;

  insert into public.invoice_payments (
    invoice_id, client_id, provider, idempotency_key, amount, currency, status
  ) values (
    p_invoice_id, p_client_id, p_provider, p_idempotency_key,
    v_invoice.total, v_invoice.currency, 'awaiting_payment'
  )
  returning * into v_payment;

  update public.invoices
    set status = 'pending', updated_at = pg_catalog.now()
    where id = p_invoice_id;

  insert into public.commercial_financial_events (
    event_type, client_id, invoice_id, payment_id, installment_sequence,
    amount, currency, details
  ) values (
    'payment_attempt_created', p_client_id, p_invoice_id, v_payment.id,
    v_invoice.installment_sequence, v_invoice.total, v_invoice.currency,
    pg_catalog.jsonb_build_object('provider', p_provider)
  );

  return pg_catalog.to_jsonb(v_payment);
end;
$$;

create or replace function public.attach_invoice_payment_checkout(
  p_payment_id uuid,
  p_provider text,
  p_transaction_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.invoice_payments%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_transaction_id is null or pg_catalog.char_length(pg_catalog.btrim(p_transaction_id)) not between 1 and 200 then
    raise exception 'invalid_provider_transaction';
  end if;

  update public.invoice_payments payment
    set provider_transaction_id = p_transaction_id
    where payment.id = p_payment_id
      and payment.provider = p_provider
      and payment.status in ('awaiting_payment', 'processing')
      and (
        payment.provider_transaction_id is null
        or payment.provider_transaction_id = p_transaction_id
      )
    returning payment.* into v_payment;

  if not found then
    raise exception 'payment_attempt_not_available';
  end if;
  return pg_catalog.to_jsonb(v_payment);
end;
$$;

create or replace function public.fail_invoice_payment_attempt(
  p_payment_id uuid,
  p_provider text,
  p_failure_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.invoice_payments%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_failure_code is null or p_failure_code !~ '^[a-z0-9_]{1,80}$' then
    raise exception 'invalid_payment_failure_code';
  end if;

  update public.invoice_payments payment
    set status = 'failed',
        completed_at = pg_catalog.now()
    where payment.id = p_payment_id
      and payment.provider = p_provider
      and payment.status in ('awaiting_payment', 'processing')
    returning payment.* into v_payment;

  if not found then
    select * into v_payment
    from public.invoice_payments payment
    where payment.id = p_payment_id
      and payment.provider = p_provider;
    if not found then
      raise exception 'payment_attempt_not_found';
    end if;
    return pg_catalog.to_jsonb(v_payment);
  end if;

  update public.invoices
    set status = 'sent', updated_at = pg_catalog.now()
    where id = v_payment.invoice_id and status = 'pending';

  insert into public.commercial_financial_events (
    event_type, client_id, invoice_id, payment_id, installment_sequence,
    amount, currency, details
  )
  select
    'payment_status_changed', v_payment.client_id, v_payment.invoice_id,
    v_payment.id, invoice.installment_sequence, v_payment.amount,
    v_payment.currency,
    pg_catalog.jsonb_build_object('status', 'failed', 'failure_code', p_failure_code)
  from public.invoices invoice
  where invoice.id = v_payment.invoice_id;

  return pg_catalog.to_jsonb(v_payment);
end;
$$;

drop function if exists public.process_commercial_payment_event(
  text, text, text, uuid, text, text, text
);

create function public.process_commercial_payment_event(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_payment_id uuid,
  p_transaction_id text,
  p_status text,
  p_payment_method text,
  p_amount numeric,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.invoice_payments%rowtype;
  v_invoice public.invoices%rowtype;
  v_event_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_provider is null or pg_catalog.char_length(pg_catalog.btrim(p_provider)) not between 1 and 80
    or p_event_id is null or pg_catalog.char_length(pg_catalog.btrim(p_event_id)) not between 1 and 200
    or p_event_type is null or pg_catalog.char_length(pg_catalog.btrim(p_event_type)) not between 1 and 120
    or p_status is null or p_status not in ('processing', 'paid', 'failed', 'cancelled', 'refunded')
    or p_amount is null or p_amount <= 0
    or p_currency is null or p_currency not in ('USD', 'PKR')
  then
    raise exception 'invalid_payment_event';
  end if;
  if p_status in ('paid', 'refunded')
    and nullif(pg_catalog.btrim(p_transaction_id), '') is null
  then
    raise exception 'verified_transaction_required';
  end if;

  insert into public.commercial_webhook_events (
    provider, provider_event_id, event_type
  ) values (
    p_provider, p_event_id, p_event_type
  )
  on conflict (provider, provider_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return pg_catalog.jsonb_build_object('duplicate', true);
  end if;

  select * into v_payment
  from public.invoice_payments payment
  where payment.id = p_payment_id
    and payment.provider = p_provider
  for update;
  if not found then
    delete from public.commercial_webhook_events where id = v_event_id;
    raise exception 'payment_not_found';
  end if;
  if v_payment.amount <> p_amount or v_payment.currency <> p_currency then
    delete from public.commercial_webhook_events where id = v_event_id;
    raise exception 'payment_amount_or_currency_mismatch';
  end if;

  select * into v_invoice
  from public.invoices invoice
  where invoice.id = v_payment.invoice_id
    and invoice.client_id = v_payment.client_id
  for update;
  if not found or v_invoice.total <> v_payment.amount
    or v_invoice.currency <> v_payment.currency
  then
    delete from public.commercial_webhook_events where id = v_event_id;
    raise exception 'invoice_payment_total_mismatch';
  end if;

  if p_status = 'paid'
    and v_payment.status = 'paid'
    and v_invoice.status = 'paid'
    and v_payment.provider_transaction_id = p_transaction_id
  then
    delete from public.commercial_webhook_events where id = v_event_id;
    return pg_catalog.jsonb_build_object('duplicate', true);
  end if;
  if p_status = 'refunded'
    and v_payment.status = 'refunded'
    and v_invoice.status = 'refunded'
    and v_payment.provider_transaction_id = p_transaction_id
  then
    delete from public.commercial_webhook_events where id = v_event_id;
    return pg_catalog.jsonb_build_object('duplicate', true);
  end if;

  if p_status = 'paid' and v_invoice.status not in ('sent', 'viewed', 'pending') then
    delete from public.commercial_webhook_events where id = v_event_id;
    raise exception 'invoice_not_payable';
  end if;
  if p_status = 'refunded' and (
    v_payment.status <> 'paid'
    or v_invoice.status <> 'paid'
    or v_payment.provider_transaction_id is distinct from p_transaction_id
  ) then
    delete from public.commercial_webhook_events where id = v_event_id;
    raise exception 'refund_payment_mismatch';
  end if;
  if v_payment.status in ('paid', 'refunded')
    and p_status not in ('paid', 'refunded')
  then
    delete from public.commercial_webhook_events where id = v_event_id;
    raise exception 'invalid_payment_transition';
  end if;

  update public.invoice_payments
    set status = p_status,
        provider_transaction_id = coalesce(
          nullif(pg_catalog.btrim(p_transaction_id), ''),
          provider_transaction_id
        ),
        payment_method = coalesce(nullif(p_payment_method, ''), payment_method),
        completed_at = case
          when p_status in ('paid', 'refunded', 'failed', 'cancelled') then pg_catalog.now()
          else completed_at
        end
    where id = p_payment_id;

  if p_status = 'paid' then
    update public.invoices
      set status = 'paid', paid_at = pg_catalog.now(), updated_at = pg_catalog.now()
      where id = v_payment.invoice_id;
  elsif p_status = 'refunded' then
    update public.invoices
      set status = 'refunded', updated_at = pg_catalog.now()
      where id = v_payment.invoice_id;
  elsif p_status = 'processing' then
    update public.invoices
      set status = 'pending', updated_at = pg_catalog.now()
      where id = v_payment.invoice_id and status in ('sent', 'viewed');
  elsif p_status in ('failed', 'cancelled') then
    update public.invoices
      set status = 'sent', updated_at = pg_catalog.now()
      where id = v_payment.invoice_id and status = 'pending';
  end if;

  insert into public.commercial_financial_events (
    event_type, client_id, invoice_id, payment_id, installment_sequence,
    amount, currency, details
  ) values (
    'payment_status_changed', v_payment.client_id, v_payment.invoice_id,
    p_payment_id, v_invoice.installment_sequence, v_payment.amount,
    v_payment.currency,
    pg_catalog.jsonb_build_object(
      'provider', p_provider,
      'provider_event_id', p_event_id,
      'status', p_status,
      'transaction_id', p_transaction_id
    )
  );

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

revoke all on function public.create_invoice_payment_attempt(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.attach_invoice_payment_checkout(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.fail_invoice_payment_attempt(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.process_commercial_payment_event(
  text, text, text, uuid, text, text, text, numeric, text
) from public, anon, authenticated;

grant execute on function public.create_invoice_payment_attempt(uuid, uuid, text, text)
  to service_role;
grant execute on function public.attach_invoice_payment_checkout(uuid, text, text)
  to service_role;
grant execute on function public.fail_invoice_payment_attempt(uuid, text, text)
  to service_role;
grant execute on function public.process_commercial_payment_event(
  text, text, text, uuid, text, text, text, numeric, text
) to service_role;
