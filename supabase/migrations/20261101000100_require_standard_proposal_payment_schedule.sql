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
  v_expires_at timestamptz;
  v_accepted_at timestamptz;
  v_amount numeric(12, 2);
  v_currency text;
  v_schedule jsonb;
  v_milestones jsonb;
  v_schedule_total numeric(12, 2);
  v_milestone_position integer;
  v_milestone_title text;
  v_snapshot jsonb;
begin
  select c.id, pp.project_id, pp.status, pp.expires_at, pp.amount,
         pg_catalog.btrim(pp.currency::text), pp.payment_schedule, pp.milestones
    into v_client_id, v_project_id, v_status, v_expires_at, v_amount,
         v_currency, v_schedule, v_milestones
  from public.clients c
  join public.project_proposals pp on pp.client_id = c.id
  where c.auth_user_id = auth.uid()
    and c.status = 'active'
    and exists (
      select 1
      from auth.users auth_user
      where auth_user.id = auth.uid()
        and coalesce(auth_user.email_confirmed_at, auth_user.confirmed_at) is not null
    )
    and pp.id = p_proposal_id
  for update of pp;

  if not found then
    raise exception 'proposal_not_found';
  end if;
  if v_status not in ('sent', 'viewed')
    or (v_expires_at is not null and v_expires_at <= pg_catalog.now())
  then
    raise exception 'proposal_not_available';
  end if;
  if v_currency not in ('USD', 'PKR')
    or pg_catalog.jsonb_typeof(v_schedule) <> 'array'
    or pg_catalog.jsonb_array_length(v_schedule) <> 3
    or pg_catalog.jsonb_typeof(v_schedule->1->'milestone_position') is distinct from 'number'
    or pg_catalog.jsonb_typeof(v_milestones) <> 'array'
    or pg_catalog.jsonb_array_length(v_milestones) = 0
  then
    raise exception 'proposal_payment_schedule_required';
  end if;
  if not (
    v_schedule->0->>'sequence' = '1'
    and v_schedule->0->>'stage' = 'advance'
    and v_schedule->0->>'percentage' = '40'
    and v_schedule->1->>'sequence' = '2'
    and v_schedule->1->>'stage' = 'agreed_milestone'
    and v_schedule->1->>'percentage' = '30'
    and v_schedule->2->>'sequence' = '3'
    and v_schedule->2->>'stage' = 'final'
    and v_schedule->2->>'percentage' = '30'
  ) then
    raise exception 'proposal_payment_schedule_invalid';
  end if;
  if coalesce(v_schedule->1->>'milestone_position', '') !~ '^[1-9][0-9]{0,1}$' then
    raise exception 'proposal_payment_schedule_invalid';
  end if;
  v_milestone_position := (v_schedule->1->>'milestone_position')::integer;
  if v_milestone_position > pg_catalog.jsonb_array_length(v_milestones) then
    raise exception 'proposal_payment_schedule_invalid';
  end if;
  select milestone.value->>'title'
    into v_milestone_title
  from pg_catalog.jsonb_array_elements(v_milestones)
       with ordinality as milestone(value, position)
  where milestone.position = v_milestone_position;
  if v_milestone_title is null or pg_catalog.char_length(pg_catalog.btrim(v_milestone_title)) = 0 then
    raise exception 'proposal_payment_schedule_invalid';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(v_schedule) as installment
    where installment->>'currency' <> v_currency
      or (installment->>'amount')::numeric <= 0
  ) then
    raise exception 'proposal_payment_schedule_invalid';
  end if;

  select pg_catalog.sum((installment->>'amount')::numeric)
    into v_schedule_total
  from pg_catalog.jsonb_array_elements(v_schedule) as installment;
  if v_schedule_total <> v_amount
    or (v_schedule->0->>'amount')::numeric <> pg_catalog.round(v_amount * 0.40, 2)
    or (v_schedule->1->>'amount')::numeric <> pg_catalog.round(v_amount * 0.30, 2)
    or (v_schedule->2->>'amount')::numeric <>
       v_amount
         - pg_catalog.round(v_amount * 0.40, 2)
         - pg_catalog.round(v_amount * 0.30, 2)
  then
    raise exception 'proposal_payment_schedule_invalid';
  end if;

  v_accepted_at := pg_catalog.now();
  select pg_catalog.jsonb_build_object(
    'proposal_id', pp.id,
    'proposal_number', pp.proposal_number,
    'client_id', pp.client_id,
    'project_id', pp.project_id,
    'title', pp.title,
    'summary', pp.summary,
    'scope', pp.scope,
    'deliverables', pp.deliverables,
    'exclusions', pp.exclusions,
    'timeline', pp.timeline,
    'milestones', pp.milestones,
    'payment_schedule', pp.payment_schedule,
    'amount', pp.amount,
    'currency', pp.currency,
    'accepted_at', v_accepted_at
  )
    into v_snapshot
    from public.project_proposals pp
    where pp.id = p_proposal_id;

  update public.project_proposals
    set status = 'accepted',
        accepted_at = v_accepted_at,
        accepted_snapshot = v_snapshot,
        updated_at = v_accepted_at
    where id = p_proposal_id;

  return v_snapshot;
end;
$$;

revoke all on function public.accept_project_proposal(uuid) from public, anon;
grant execute on function public.accept_project_proposal(uuid) to authenticated;
