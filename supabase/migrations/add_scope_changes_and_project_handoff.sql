create table public.project_scope_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 160),
  description text not null check (char_length(btrim(description)) between 10 and 5000),
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'rejected')),
  decision_note text check (decision_note is null or char_length(btrim(decision_note)) <= 5000),
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_scope_changes_review_state_check
    check (
      (status = 'requested' and reviewed_at is null and reviewed_by is null)
      or (status in ('approved', 'rejected') and reviewed_at is not null and reviewed_by is not null)
    )
);

create index project_scope_changes_project_created_idx
  on public.project_scope_changes (project_id, created_at desc);
create index project_scope_changes_pending_idx
  on public.project_scope_changes (created_at desc)
  where status = 'requested';

alter table public.project_scope_changes enable row level security;
revoke all on public.project_scope_changes from public, anon, authenticated;
grant select (
  id, project_id, requested_by, title, description, status, reviewed_at, created_at, updated_at
) on public.project_scope_changes to authenticated;
grant select, insert, update on public.project_scope_changes to service_role;

create policy project_scope_changes_select_own
  on public.project_scope_changes
  for select
  to authenticated
  using (
    requested_by = (select auth.uid())
    and exists (
      select 1
      from public.client_projects project
      join public.clients client on client.id = project.client_id
      where project.id = project_scope_changes.project_id
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
    'scope_change_requested',
    'scope_change_approved',
    'scope_change_rejected',
    'project_completed'
  ));

create or replace function public.request_project_scope_change(
  p_project_id uuid,
  p_auth_user_id uuid,
  p_title text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.client_projects%rowtype;
  v_change public.project_scope_changes%rowtype;
begin
  if p_project_id is null
    or p_auth_user_id is null
    or p_title is null
    or pg_catalog.char_length(pg_catalog.btrim(p_title)) not between 3 and 160
    or p_description is null
    or pg_catalog.char_length(pg_catalog.btrim(p_description)) not between 10 and 5000
  then
    return pg_catalog.jsonb_build_object('outcome', 'invalid_request');
  end if;

  select project.*
  into v_project
  from public.client_projects project
  where project.id = p_project_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;
  if v_project.status <> 'active' then
    return pg_catalog.jsonb_build_object('outcome', 'project_not_active');
  end if;
  if not exists (
    select 1
    from public.clients client
    where client.id = v_project.client_id
      and client.auth_user_id = p_auth_user_id
      and client.status = 'active'
  ) then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;

  insert into public.project_scope_changes (
    project_id, requested_by, title, description
  )
  values (
    p_project_id,
    p_auth_user_id,
    pg_catalog.btrim(p_title),
    pg_catalog.btrim(p_description)
  )
  returning * into v_change;

  insert into public.project_activity (project_id, event_type, actor_type, actor_id, details)
  values (
    p_project_id,
    'scope_change_requested',
    'client',
    p_auth_user_id,
    pg_catalog.jsonb_build_object('title', v_change.title)
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'requested',
    'scope_change_id', v_change.id
  );
end;
$$;

revoke all on function public.request_project_scope_change(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.request_project_scope_change(uuid, uuid, text, text)
  to service_role;

create or replace function public.review_project_scope_change(
  p_project_id uuid,
  p_scope_change_id uuid,
  p_action text,
  p_decision_note text,
  p_reviewed_by text default 'admin'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.client_projects%rowtype;
  v_change public.project_scope_changes%rowtype;
  v_next_status text;
begin
  if p_project_id is null
    or p_scope_change_id is null
    or p_action is null
    or p_action not in ('approve', 'reject')
    or p_reviewed_by is null
    or pg_catalog.char_length(pg_catalog.btrim(p_reviewed_by)) not between 1 and 100
    or (p_decision_note is not null and pg_catalog.char_length(pg_catalog.btrim(p_decision_note)) > 5000)
  then
    return pg_catalog.jsonb_build_object('outcome', 'invalid_action');
  end if;

  select project.*
  into v_project
  from public.client_projects project
  where project.id = p_project_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;
  if v_project.status <> 'active' then
    return pg_catalog.jsonb_build_object('outcome', 'project_not_active');
  end if;

  select scope_change.*
  into v_change
  from public.project_scope_changes scope_change
  where scope_change.id = p_scope_change_id
    and scope_change.project_id = p_project_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;
  if v_change.status <> 'requested' then
    return pg_catalog.jsonb_build_object('outcome', 'conflict');
  end if;

  v_next_status := case when p_action = 'approve' then 'approved' else 'rejected' end;
  update public.project_scope_changes
  set status = v_next_status,
      decision_note = nullif(pg_catalog.btrim(p_decision_note), ''),
      reviewed_at = pg_catalog.clock_timestamp(),
      reviewed_by = pg_catalog.btrim(p_reviewed_by),
      updated_at = pg_catalog.clock_timestamp()
  where id = p_scope_change_id;

  insert into public.project_activity (project_id, event_type, actor_type, details)
  values (
    p_project_id,
    case when p_action = 'approve' then 'scope_change_approved' else 'scope_change_rejected' end,
    'admin',
    pg_catalog.jsonb_build_object('title', v_change.title)
  );

  return pg_catalog.jsonb_build_object('outcome', v_next_status);
end;
$$;

revoke all on function public.review_project_scope_change(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.review_project_scope_change(uuid, uuid, text, text, text)
  to service_role;

create or replace function public.complete_client_project(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.client_projects%rowtype;
  v_incomplete_milestones integer;
  v_incomplete_deliverables integer;
  v_pending_scope_changes integer;
begin
  if p_project_id is null then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;

  select project.*
  into v_project
  from public.client_projects project
  where project.id = p_project_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;
  if v_project.status = 'completed' then
    return pg_catalog.jsonb_build_object(
      'outcome', 'already_completed',
      'completed_at', v_project.completed_at
    );
  end if;
  if v_project.status <> 'active' then
    return pg_catalog.jsonb_build_object('outcome', 'project_not_active');
  end if;

  select pg_catalog.count(*)::integer
  into v_incomplete_milestones
  from public.project_milestones milestone
  where milestone.project_id = p_project_id
    and milestone.status <> 'completed';

  select pg_catalog.count(*)::integer
  into v_incomplete_deliverables
  from public.project_deliverables deliverable
  where deliverable.project_id = p_project_id
    and deliverable.status <> 'completed';

  select pg_catalog.count(*)::integer
  into v_pending_scope_changes
  from public.project_scope_changes scope_change
  where scope_change.project_id = p_project_id
    and scope_change.status = 'requested';

  if v_incomplete_milestones > 0
    or v_incomplete_deliverables > 0
    or v_pending_scope_changes > 0
  then
    return pg_catalog.jsonb_build_object(
      'outcome', 'blocked',
      'incomplete_milestones', v_incomplete_milestones,
      'incomplete_deliverables', v_incomplete_deliverables,
      'pending_scope_changes', v_pending_scope_changes
    );
  end if;

  update public.client_projects
  set status = 'completed',
      completed_at = pg_catalog.clock_timestamp(),
      updated_at = pg_catalog.clock_timestamp()
  where id = p_project_id
  returning * into v_project;

  insert into public.project_activity (project_id, event_type, actor_type, details)
  values (
    p_project_id,
    'project_completed',
    'admin',
    pg_catalog.jsonb_build_object('completed_at', v_project.completed_at)
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'completed',
    'completed_at', v_project.completed_at
  );
end;
$$;

revoke all on function public.complete_client_project(uuid)
  from public, anon, authenticated;
grant execute on function public.complete_client_project(uuid)
  to service_role;

create or replace function public.transition_project_milestone(
  p_project_id uuid,
  p_milestone_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.client_projects%rowtype;
  v_milestone public.project_milestones%rowtype;
  v_next public.project_milestones%rowtype;
  v_incomplete_count integer;
  v_has_next boolean := false;
begin
  if p_action is null
    or p_action not in ('start', 'submit_for_review', 'approve', 'complete')
  then
    return pg_catalog.jsonb_build_object('outcome', 'invalid_action');
  end if;

  select project.*
  into v_project
  from public.client_projects project
  where project.id = p_project_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;
  if v_project.status <> 'active' then
    return pg_catalog.jsonb_build_object('outcome', 'project_not_active');
  end if;

  select milestone.*
  into v_milestone
  from public.project_milestones milestone
  where milestone.id = p_milestone_id
    and milestone.project_id = p_project_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;

  if p_action = 'start' then
    if v_milestone.status <> 'upcoming'
      or exists (
        select 1
        from public.project_milestones other_milestone
        where other_milestone.project_id = p_project_id
          and other_milestone.id <> p_milestone_id
          and other_milestone.status in ('active', 'client_review')
      )
      or exists (
        select 1
        from public.project_milestones previous_milestone
        where previous_milestone.project_id = p_project_id
          and previous_milestone.position < v_milestone.position
          and previous_milestone.status not in ('approved', 'completed')
      )
    then
      return pg_catalog.jsonb_build_object('outcome', 'conflict');
    end if;

    update public.project_milestones
    set status = 'active',
        start_date = coalesce(start_date, current_date),
        updated_at = pg_catalog.clock_timestamp()
    where id = p_milestone_id;

    insert into public.project_activity (project_id, event_type, actor_type, details)
    values (
      p_project_id,
      'milestone_started',
      'admin',
      pg_catalog.jsonb_build_object('milestone_id', p_milestone_id, 'title', v_milestone.title)
    );
    return pg_catalog.jsonb_build_object(
      'outcome', 'transitioned',
      'milestone_status', 'active',
      'project_status', v_project.status,
      'next_milestone_title', null
    );
  end if;

  if p_action = 'submit_for_review' then
    if v_milestone.status <> 'active' then
      return pg_catalog.jsonb_build_object('outcome', 'conflict');
    end if;
    update public.project_milestones
    set status = 'client_review',
        updated_at = pg_catalog.clock_timestamp()
    where id = p_milestone_id;
    insert into public.project_activity (project_id, event_type, actor_type, details)
    values (
      p_project_id,
      'milestone_submitted_for_review',
      'admin',
      pg_catalog.jsonb_build_object('milestone_id', p_milestone_id, 'title', v_milestone.title)
    );
    return pg_catalog.jsonb_build_object(
      'outcome', 'transitioned',
      'milestone_status', 'client_review',
      'project_status', v_project.status,
      'next_milestone_title', null
    );
  end if;

  if p_action = 'approve' then
    if v_milestone.status <> 'client_review' then
      return pg_catalog.jsonb_build_object('outcome', 'conflict');
    end if;
    update public.project_milestones
    set status = 'approved',
        updated_at = pg_catalog.clock_timestamp()
    where id = p_milestone_id;
    insert into public.project_activity (project_id, event_type, actor_type, details)
    values (
      p_project_id,
      'milestone_approved',
      'admin',
      pg_catalog.jsonb_build_object('milestone_id', p_milestone_id, 'title', v_milestone.title)
    );
    return pg_catalog.jsonb_build_object(
      'outcome', 'transitioned',
      'milestone_status', 'approved',
      'project_status', v_project.status,
      'next_milestone_title', null
    );
  end if;

  if v_milestone.status not in ('active', 'approved') then
    return pg_catalog.jsonb_build_object('outcome', 'conflict');
  end if;

  update public.project_milestones
  set status = 'completed',
      completed_at = coalesce(completed_at, pg_catalog.clock_timestamp()),
      updated_at = pg_catalog.clock_timestamp()
  where id = p_milestone_id;
  insert into public.project_activity (project_id, event_type, actor_type, details)
  values (
    p_project_id,
    'milestone_completed',
    'admin',
    pg_catalog.jsonb_build_object('milestone_id', p_milestone_id, 'title', v_milestone.title)
  );

  select pg_catalog.count(*)::integer
  into v_incomplete_count
  from public.project_milestones milestone
  where milestone.project_id = p_project_id
    and milestone.status <> 'completed';

  if v_incomplete_count = 0 then
    return pg_catalog.jsonb_build_object(
      'outcome', 'transitioned',
      'milestone_status', 'completed',
      'project_status', v_project.status,
      'next_milestone_title', null
    );
  end if;

  select milestone.*
  into v_next
  from public.project_milestones milestone
  where milestone.project_id = p_project_id
    and milestone.status = 'upcoming'
    and milestone.position > v_milestone.position
    and not exists (
      select 1
      from public.project_milestones previous_milestone
      where previous_milestone.project_id = p_project_id
        and previous_milestone.position < milestone.position
        and previous_milestone.status not in ('approved', 'completed')
    )
  order by milestone.position
  limit 1
  for update;

  v_has_next := found;
  if v_has_next then
    update public.project_milestones
    set status = 'active',
        start_date = coalesce(start_date, current_date),
        updated_at = pg_catalog.clock_timestamp()
    where id = v_next.id;
    insert into public.project_activity (project_id, event_type, actor_type, details)
    values (
      p_project_id,
      'milestone_started',
      'admin',
      pg_catalog.jsonb_build_object('milestone_id', v_next.id, 'title', v_next.title)
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'outcome', 'transitioned',
    'milestone_status', 'completed',
    'project_status', v_project.status,
    'next_milestone_title', case when v_has_next then v_next.title else null end
  );
end;
$$;

revoke all on function public.transition_project_milestone(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.transition_project_milestone(uuid, uuid, text)
  to service_role;
