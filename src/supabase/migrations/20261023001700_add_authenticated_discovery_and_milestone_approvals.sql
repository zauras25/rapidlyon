create or replace function public.get_or_create_authenticated_client(
  p_auth_user_id uuid,
  p_auth_email text,
  p_name text,
  p_company text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients%rowtype;
  v_auth_email text;
begin
  if p_auth_user_id is null
    or p_auth_email is null
    or p_name is null
    or pg_catalog.char_length(pg_catalog.btrim(p_name)) not between 2 and 160
    or (p_company is not null and pg_catalog.char_length(pg_catalog.btrim(p_company)) > 160)
  then
    raise exception 'invalid_client_identity';
  end if;

  select auth_user.email
  into v_auth_email
  from auth.users auth_user
  where auth_user.id = p_auth_user_id
    and auth_user.email_confirmed_at is not null;

  if not found
    or pg_catalog.lower(pg_catalog.btrim(v_auth_email)) <> pg_catalog.lower(pg_catalog.btrim(p_auth_email))
  then
    raise exception 'verified_client_identity_required';
  end if;

  insert into public.clients (auth_user_id, name, email, company, status)
  values (
    p_auth_user_id,
    pg_catalog.btrim(p_name),
    pg_catalog.lower(pg_catalog.btrim(p_auth_email)),
    nullif(pg_catalog.btrim(p_company), ''),
    'active'
  )
  on conflict do nothing;

  select client.*
  into v_client
  from public.clients client
  where pg_catalog.lower(pg_catalog.btrim(client.email)) = pg_catalog.lower(pg_catalog.btrim(p_auth_email))
     or client.auth_user_id = p_auth_user_id
  for update;

  if not found
    or v_client.status <> 'active'
    or (v_client.auth_user_id is not null and v_client.auth_user_id <> p_auth_user_id)
    or pg_catalog.lower(pg_catalog.btrim(v_client.email)) <> pg_catalog.lower(pg_catalog.btrim(p_auth_email))
  then
    raise exception 'client_identity_conflict';
  end if;

  update public.clients
  set auth_user_id = p_auth_user_id,
      name = pg_catalog.btrim(p_name),
      company = nullif(pg_catalog.btrim(p_company), ''),
      updated_at = pg_catalog.clock_timestamp()
  where id = v_client.id
    and (auth_user_id is null or auth_user_id = p_auth_user_id);

  return v_client.id;
end;
$$;

revoke all on function public.get_or_create_authenticated_client(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.get_or_create_authenticated_client(uuid, text, text, text)
  to service_role;

create or replace function public.create_client_project_from_discovery(
  p_submission_id uuid,
  p_name text,
  p_service_type text,
  p_overview text,
  p_milestones jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.discovery_submissions%rowtype;
  v_project_id uuid;
  v_milestone jsonb;
  v_title text;
  v_description text;
  v_due_text text;
  v_position integer := 0;
begin
  if p_submission_id is null
    or p_name is null
    or pg_catalog.char_length(pg_catalog.btrim(p_name)) not between 1 and 200
    or p_service_type is null
    or pg_catalog.char_length(pg_catalog.btrim(p_service_type)) not between 1 and 120
    or p_overview is null
    or pg_catalog.char_length(pg_catalog.btrim(p_overview)) not between 1 and 5000
  then
    raise exception 'invalid_client_project';
  end if;

  if p_milestones is null
    or pg_catalog.jsonb_typeof(p_milestones) is distinct from 'array'
  then
    raise exception 'invalid_client_project_milestones';
  end if;
  if pg_catalog.jsonb_array_length(p_milestones) not between 1 and 20 then
    raise exception 'invalid_client_project_milestones';
  end if;

  select submission.*
  into v_submission
  from public.discovery_submissions submission
  where submission.id = p_submission_id
  for update;

  if not found or v_submission.client_id is null or v_submission.client_project_id is not null then
    raise exception 'discovery_submission_not_available_for_project';
  end if;

  if not exists (
    select 1
    from public.clients client
    where client.id = v_submission.client_id
      and client.status = 'active'
      and pg_catalog.lower(pg_catalog.btrim(client.email)) =
        pg_catalog.lower(pg_catalog.btrim(v_submission.email))
  ) then
    raise exception 'active_client_required';
  end if;

  insert into public.client_projects (
    client_id,
    name,
    service_type,
    status,
    agreed_scope
  )
  values (
    v_submission.client_id,
    pg_catalog.btrim(p_name),
    pg_catalog.btrim(p_service_type),
    'draft',
    pg_catalog.jsonb_build_object('overview', pg_catalog.btrim(p_overview))
  )
  returning id into v_project_id;

  for v_milestone in
    select entry.value
    from pg_catalog.jsonb_array_elements(p_milestones) with ordinality as entry(value, position)
    order by entry.position
  loop
    v_title := pg_catalog.btrim(coalesce(v_milestone->>'title', ''));
    v_description := coalesce(v_milestone->>'description', '');
    v_due_text := nullif(pg_catalog.btrim(coalesce(v_milestone->>'due_date', '')), '');

    if pg_catalog.jsonb_typeof(v_milestone) <> 'object'
      or pg_catalog.char_length(v_title) not between 1 and 200
      or pg_catalog.char_length(v_description) > 5000
      or (v_due_text is not null and v_due_text !~ '^\d{4}-\d{2}-\d{2}$')
    then
      raise exception 'invalid_client_project_milestone';
    end if;

    insert into public.project_milestones (
      project_id,
      title,
      description,
      position,
      status,
      due_date
    )
    values (
      v_project_id,
      v_title,
      v_description,
      v_position,
      'upcoming',
      v_due_text::date
    );
    v_position := v_position + 1;
  end loop;

  update public.discovery_submissions
  set client_project_id = v_project_id,
      qualification_status = 'qualified',
      updated_at = pg_catalog.clock_timestamp()
  where id = p_submission_id;

  insert into public.project_activity (project_id, event_type, actor_type, details)
  values (
    v_project_id,
    'project_created',
    'admin',
    pg_catalog.jsonb_build_object('discovery_submission_id', p_submission_id)
  );

  return v_project_id;
end;
$$;

revoke all on function public.create_client_project_from_discovery(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_client_project_from_discovery(uuid, text, text, text, jsonb)
  to service_role;

create policy discovery_submissions_select_own
  on public.discovery_submissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.clients client
      where client.id = discovery_submissions.client_id
        and client.auth_user_id = (select auth.uid())
        and client.status = 'active'
    )
  );

grant select on public.discovery_submissions to authenticated;

alter table public.project_milestones
  add column if not exists client_approved_at timestamptz,
  add column if not exists admin_approved_at timestamptz;

update public.project_milestones
set status = 'client_review',
    admin_approved_at = coalesce(admin_approved_at, updated_at)
where status = 'approved'
  and client_approved_at is null;

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
    'milestone_completed',
    'deliverable_submitted',
    'client_feedback_received',
    'deliverable_approved',
    'project_completed'
  ));

create or replace function public.record_project_milestone_approval(
  p_project_id uuid,
  p_milestone_id uuid,
  p_actor_type text,
  p_auth_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.client_projects%rowtype;
  v_milestone public.project_milestones%rowtype;
  v_status text;
begin
  if p_actor_type is null or p_actor_type not in ('admin', 'client') then
    return pg_catalog.jsonb_build_object('outcome', 'invalid_actor');
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

  if p_actor_type = 'client' and not exists (
    select 1
    from public.clients client
    where client.id = v_project.client_id
      and client.auth_user_id = p_auth_user_id
      and client.status = 'active'
  ) then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
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

  if v_milestone.status <> 'client_review' then
    return pg_catalog.jsonb_build_object('outcome', 'conflict');
  end if;

  if p_actor_type = 'admin' then
    if v_milestone.admin_approved_at is not null then
      return pg_catalog.jsonb_build_object('outcome', 'conflict');
    end if;
    update public.project_milestones
    set admin_approved_at = pg_catalog.clock_timestamp(),
        updated_at = pg_catalog.clock_timestamp()
    where id = p_milestone_id;
  else
    if v_milestone.client_approved_at is not null then
      return pg_catalog.jsonb_build_object('outcome', 'conflict');
    end if;
    update public.project_milestones
    set client_approved_at = pg_catalog.clock_timestamp(),
        updated_at = pg_catalog.clock_timestamp()
    where id = p_milestone_id;
  end if;

  if (v_milestone.admin_approved_at is not null or p_actor_type = 'admin')
    and (v_milestone.client_approved_at is not null or p_actor_type = 'client')
  then
    update public.project_milestones
    set status = 'approved',
        updated_at = pg_catalog.clock_timestamp()
    where id = p_milestone_id;
    v_status := 'approved';
  else
    v_status := 'client_review';
  end if;

  insert into public.project_activity (project_id, event_type, actor_type, actor_id, details)
  values (
    p_project_id,
    case when p_actor_type = 'client' then 'milestone_client_approved' else 'milestone_approved' end,
    p_actor_type,
    case when p_actor_type = 'client' then p_auth_user_id else null end,
    pg_catalog.jsonb_build_object('milestone_id', p_milestone_id, 'title', v_milestone.title)
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'transitioned',
    'milestone_status', v_status,
    'client_approved', v_milestone.client_approved_at is not null or p_actor_type = 'client',
    'admin_approved', v_milestone.admin_approved_at is not null or p_actor_type = 'admin'
  );
end;
$$;

revoke all on function public.record_project_milestone_approval(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.record_project_milestone_approval(uuid, uuid, text, uuid)
  to service_role;

create or replace function public.complete_approved_project_milestone(
  p_project_id uuid,
  p_milestone_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.project_milestones milestone
    where milestone.id = p_milestone_id
      and milestone.project_id = p_project_id
      and milestone.status = 'approved'
      and milestone.client_approved_at is not null
      and milestone.admin_approved_at is not null
  ) then
    return pg_catalog.jsonb_build_object('outcome', 'conflict');
  end if;

  return public.transition_project_milestone(p_project_id, p_milestone_id, 'complete');
end;
$$;

revoke all on function public.complete_approved_project_milestone(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.complete_approved_project_milestone(uuid, uuid)
  to service_role;
