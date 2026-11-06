alter table public.project_deliverables
  add constraint project_deliverables_id_project_id_key unique (id, project_id);

create table public.deliverable_feedback (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null,
  project_id uuid not null,
  actor_auth_user_id uuid not null references auth.users(id) on delete restrict,
  message text not null check (char_length(btrim(message)) between 10 and 5000),
  created_at timestamptz not null default now(),
  constraint deliverable_feedback_deliverable_project_fkey
    foreign key (deliverable_id, project_id)
    references public.project_deliverables (id, project_id) on delete restrict
);

create index deliverable_feedback_deliverable_created_idx
  on public.deliverable_feedback (deliverable_id, created_at desc);

alter table public.deliverable_feedback enable row level security;
revoke all on public.deliverable_feedback from public, anon, authenticated;
grant select on public.deliverable_feedback to authenticated;
grant select, insert on public.deliverable_feedback to service_role;

create policy deliverable_feedback_select_own
  on public.deliverable_feedback
  for select
  to authenticated
  using (
    actor_auth_user_id = (select auth.uid())
    and exists (
      select 1
      from public.client_projects project
      join public.clients client on client.id = project.client_id
      where project.id = deliverable_feedback.project_id
        and client.auth_user_id = (select auth.uid())
        and client.status = 'active'
    )
  );

alter table public.project_activity
  drop constraint if exists project_activity_event_type_check;

alter table public.project_activity
  add constraint project_activity_event_type_check
  check (event_type in (
    'project_created',
    'invitation_sent',
    'invitation_accepted',
    'milestone_activated',
    'milestone_started',
    'milestone_submitted_for_review',
    'milestone_approved',
    'milestone_client_approved',
    'milestone_reopened_for_changes',
    'milestone_completed',
    'deliverable_submitted',
    'deliverable_ready_for_review',
    'deliverable_approved',
    'deliverable_changes_requested',
    'deliverable_resubmitted',
    'deliverable_completed',
    'client_feedback_received',
    'project_completed'
  ));

create or replace function public.enforce_milestone_deliverable_readiness()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'client_review'
    and exists (
      select 1
      from public.project_deliverables deliverable
      where deliverable.milestone_id = new.id
        and deliverable.status not in ('ready_for_review', 'approved', 'completed')
    )
  then
    raise exception 'milestone_deliverables_not_ready';
  end if;

  if new.status in ('approved', 'completed')
    and exists (
      select 1
      from public.project_deliverables deliverable
      where deliverable.milestone_id = new.id
        and deliverable.status not in ('approved', 'completed')
    )
  then
    raise exception 'milestone_deliverables_not_approved';
  end if;

  return new;
end;
$$;

create trigger project_milestones_enforce_deliverable_readiness
  before update of status on public.project_milestones
  for each row
  when (old.status is distinct from new.status)
  execute function public.enforce_milestone_deliverable_readiness();

create or replace function public.transition_project_deliverable(
  p_deliverable_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_project_status text;
  v_deliverable public.project_deliverables%rowtype;
  v_milestone public.project_milestones%rowtype;
  v_milestone_result jsonb;
  v_has_feedback boolean := false;
  v_next_status text;
  v_event_type text;
begin
  if p_deliverable_id is null
    or p_action is null
    or p_action not in ('start', 'ready_for_review', 'complete')
  then
    return pg_catalog.jsonb_build_object('outcome', 'invalid_action');
  end if;

  select deliverable.project_id
  into v_project_id
  from public.project_deliverables deliverable
  where deliverable.id = p_deliverable_id;

  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;

  select project.status
  into v_project_status
  from public.client_projects project
  where project.id = v_project_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;
  if v_project_status <> 'active' then
    return pg_catalog.jsonb_build_object('outcome', 'project_not_active');
  end if;

  select deliverable.*
  into v_deliverable
  from public.project_deliverables deliverable
  where deliverable.id = p_deliverable_id
    and deliverable.project_id = v_project_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;

  if p_action = 'start' then
    if v_deliverable.status not in ('draft', 'changes_requested') then
      return pg_catalog.jsonb_build_object('outcome', 'conflict');
    end if;
    v_next_status := 'in_progress';
    v_event_type := null;
  elsif p_action = 'ready_for_review' then
    if v_deliverable.status <> 'in_progress' then
      return pg_catalog.jsonb_build_object('outcome', 'conflict');
    end if;
    v_next_status := 'ready_for_review';
    select exists (
      select 1
      from public.deliverable_feedback feedback
      where feedback.deliverable_id = p_deliverable_id
    ) into v_has_feedback;
    v_event_type := case when v_has_feedback
      then 'deliverable_resubmitted'
      else 'deliverable_ready_for_review'
    end;
  else
    if v_deliverable.status <> 'approved' then
      return pg_catalog.jsonb_build_object('outcome', 'conflict');
    end if;
    v_next_status := 'completed';
    v_event_type := 'deliverable_completed';
  end if;

  select milestone.*
  into v_milestone
  from public.project_milestones milestone
  where milestone.id = v_deliverable.milestone_id
    and milestone.project_id = v_project_id
  for update;

  if v_deliverable.milestone_id is not null and not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;
  if v_milestone.id is not null
    and p_action <> 'complete'
    and v_milestone.status <> 'active'
  then
    return pg_catalog.jsonb_build_object('outcome', 'conflict');
  end if;

  update public.project_deliverables
  set status = v_next_status,
      submitted_at = case
        when v_next_status = 'ready_for_review' then pg_catalog.clock_timestamp()
        when v_next_status = 'in_progress' then null
        else submitted_at
      end,
      approved_at = case
        when v_next_status = 'completed' then approved_at
        else null
      end,
      updated_at = pg_catalog.clock_timestamp()
  where id = p_deliverable_id;

  if v_event_type is not null then
    insert into public.project_activity (project_id, event_type, actor_type, details)
    values (
      v_project_id,
      v_event_type,
      'admin',
      pg_catalog.jsonb_build_object('deliverable_title', v_deliverable.title)
    );
  end if;

  if p_action = 'ready_for_review'
    and v_milestone.id is not null
    and v_milestone.status = 'active'
    and not exists (
      select 1
      from public.project_deliverables other_deliverable
      where other_deliverable.milestone_id = v_milestone.id
        and other_deliverable.id <> p_deliverable_id
        and other_deliverable.status not in ('ready_for_review', 'approved', 'completed')
    )
  then
    v_milestone_result := public.transition_project_milestone(
      v_project_id,
      v_milestone.id,
      'submit_for_review'
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'outcome', 'transitioned',
    'deliverable_status', v_next_status
  );
end;
$$;

revoke all on function public.transition_project_deliverable(uuid, text)
  from public, anon, authenticated;
grant execute on function public.transition_project_deliverable(uuid, text)
  to service_role;

create or replace function public.review_project_deliverable(
  p_deliverable_id uuid,
  p_auth_user_id uuid,
  p_action text,
  p_feedback text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_project_id uuid;
  v_project_status text;
  v_deliverable public.project_deliverables%rowtype;
  v_milestone public.project_milestones%rowtype;
  v_milestone_result jsonb;
  v_remaining integer;
begin
  if p_deliverable_id is null
    or p_auth_user_id is null
    or p_action is null
    or p_action not in ('approve', 'request_changes')
  then
    return pg_catalog.jsonb_build_object('outcome', 'invalid_action');
  end if;

  if p_action = 'request_changes'
    and (p_feedback is null or pg_catalog.char_length(pg_catalog.btrim(p_feedback)) not between 10 and 5000)
  then
    return pg_catalog.jsonb_build_object('outcome', 'invalid_feedback');
  end if;

  select client.id
  into v_client_id
  from public.clients client
  where client.auth_user_id = p_auth_user_id
    and client.status = 'active';

  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;

  select deliverable.project_id
  into v_project_id
  from public.project_deliverables deliverable
  join public.client_projects project on project.id = deliverable.project_id
  where deliverable.id = p_deliverable_id
    and project.client_id = v_client_id;

  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;

  select project.status
  into v_project_status
  from public.client_projects project
  where project.id = v_project_id
    and project.client_id = v_client_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;
  if v_project_status <> 'active' then
    return pg_catalog.jsonb_build_object('outcome', 'project_not_active');
  end if;

  select deliverable.*
  into v_deliverable
  from public.project_deliverables deliverable
  where deliverable.id = p_deliverable_id
    and deliverable.project_id = v_project_id
  for update;

  if not found or v_deliverable.status <> 'ready_for_review' then
    return pg_catalog.jsonb_build_object('outcome', 'conflict');
  end if;

  select milestone.*
  into v_milestone
  from public.project_milestones milestone
  where milestone.id = v_deliverable.milestone_id
    and milestone.project_id = v_project_id
  for update;

  if v_deliverable.milestone_id is not null and not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;
  if v_milestone.id is not null
    and v_milestone.status in ('approved', 'completed')
  then
    return pg_catalog.jsonb_build_object('outcome', 'conflict');
  end if;

  if p_action = 'request_changes' then
    insert into public.deliverable_feedback (
      deliverable_id,
      project_id,
      actor_auth_user_id,
      message
    )
    values (
      p_deliverable_id,
      v_project_id,
      p_auth_user_id,
      pg_catalog.btrim(p_feedback)
    );

    update public.project_deliverables
    set status = 'changes_requested',
        approved_at = null,
        updated_at = pg_catalog.clock_timestamp()
    where id = p_deliverable_id;

    insert into public.project_activity (project_id, event_type, actor_type, actor_id, details)
    values (
      v_project_id,
      'deliverable_changes_requested',
      'client',
      p_auth_user_id,
      pg_catalog.jsonb_build_object('deliverable_title', v_deliverable.title)
    );

    if v_milestone.id is not null and v_milestone.status = 'client_review' then
      update public.project_milestones
      set status = 'active',
          client_approved_at = null,
          admin_approved_at = null,
          updated_at = pg_catalog.clock_timestamp()
      where id = v_milestone.id;

      insert into public.project_activity (project_id, event_type, actor_type, details)
      values (
        v_project_id,
        'milestone_reopened_for_changes',
        'system',
        pg_catalog.jsonb_build_object('milestone_title', v_milestone.title)
      );
    end if;

    return pg_catalog.jsonb_build_object(
      'outcome', 'transitioned',
      'deliverable_status', 'changes_requested'
    );
  end if;

  update public.project_deliverables
  set status = 'approved',
      approved_at = pg_catalog.clock_timestamp(),
      updated_at = pg_catalog.clock_timestamp()
  where id = p_deliverable_id;

  insert into public.project_activity (project_id, event_type, actor_type, actor_id, details)
  values (
    v_project_id,
    'deliverable_approved',
    'client',
    p_auth_user_id,
    pg_catalog.jsonb_build_object('deliverable_title', v_deliverable.title)
  );

  if v_milestone.id is not null then
    select count(*)
    into v_remaining
    from public.project_deliverables deliverable
    where deliverable.milestone_id = v_milestone.id
      and deliverable.status not in ('approved', 'completed');

    if v_remaining = 0 then
      if v_milestone.status = 'active' then
        v_milestone_result := public.transition_project_milestone(
          v_project_id,
          v_milestone.id,
          'submit_for_review'
        );
        if v_milestone_result->>'outcome' = 'transitioned' then
          v_milestone.status := 'client_review';
        end if;
      end if;

      if v_milestone.status = 'client_review' then
        v_milestone_result := public.record_project_milestone_approval(
          v_project_id,
          v_milestone.id,
          'client',
          p_auth_user_id
        );
      end if;
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'outcome', 'transitioned',
    'deliverable_status', 'approved'
  );
end;
$$;

revoke all on function public.review_project_deliverable(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_project_deliverable(uuid, uuid, text, text)
  to service_role;
