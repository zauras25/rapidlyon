alter table public.project_proposals
  add column if not exists accepted_snapshot jsonb
    check (accepted_snapshot is null or jsonb_typeof(accepted_snapshot) = 'object');

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
  v_snapshot jsonb;
begin
  select c.id, pp.project_id, pp.status, pp.expires_at
    into v_client_id, v_project_id, v_status, v_expires_at
  from public.clients c
  join public.project_proposals pp on pp.client_id = c.id
  where c.auth_user_id = auth.uid()
    and c.status = 'active'
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
