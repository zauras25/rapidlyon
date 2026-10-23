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
    'milestone_completed',
    'deliverable_submitted',
    'client_feedback_received',
    'deliverable_approved',
    'project_completed'
  ));

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

  select count(*)
  into v_incomplete_count
  from public.project_milestones milestone
  where milestone.project_id = p_project_id
    and milestone.status <> 'completed';

  if v_incomplete_count = 0 then
    update public.client_projects
    set status = 'completed',
        completed_at = coalesce(completed_at, pg_catalog.clock_timestamp()),
        updated_at = pg_catalog.clock_timestamp()
    where id = p_project_id;

    insert into public.project_activity (project_id, event_type, actor_type, details)
    values (
      p_project_id,
      'project_completed',
      'admin',
      pg_catalog.jsonb_build_object('milestone_id', p_milestone_id)
    );

    return pg_catalog.jsonb_build_object(
      'outcome', 'project_completed',
      'milestone_status', 'completed',
      'project_status', 'completed',
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
