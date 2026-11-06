alter table public.project_reviews
  add column client_id uuid references public.clients(id) on delete set null,
  add column client_project_id uuid;

alter table public.project_reviews
  add constraint project_reviews_project_requires_client
    check (client_project_id is null or client_id is not null),
  add constraint project_reviews_project_client_fkey
    foreign key (client_project_id, client_id)
    references public.client_projects (id, client_id)
    on delete set null;

create unique index project_reviews_one_per_client_project_idx
  on public.project_reviews (client_project_id)
  where client_project_id is not null;

create index project_reviews_client_id_idx
  on public.project_reviews (client_id)
  where client_id is not null;

alter table public.project_reviews enable row level security;
revoke all on public.project_reviews from public, anon, authenticated;
grant select (
  id, client_id, client_project_id, name, rating, review, status, created_at, updated_at
) on public.project_reviews to authenticated;

create policy project_reviews_select_own_completed_project
  on public.project_reviews
  for select
  to authenticated
  using (
    client_project_id is not null
    and exists (
      select 1
      from public.client_projects project
      join public.clients client on client.id = project.client_id
      where project.id = project_reviews.client_project_id
        and project.client_id = project_reviews.client_id
        and project.status = 'completed'
        and client.auth_user_id = (select auth.uid())
        and client.status = 'active'
    )
  );

revoke all on public.discovery_submissions from public, anon, authenticated;
grant select (
  id, client_id, client_project_id, status, qualification_status,
  created_at, next_action, follow_up_at
) on public.discovery_submissions to authenticated;

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
    'project_completed',
    'project_review_submitted'
  ));

create or replace function public.submit_completed_project_review(
  p_project_id uuid,
  p_auth_user_id uuid,
  p_rating smallint,
  p_review text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_client_name text;
  v_project_status text;
  v_review_id uuid;
  v_created_at timestamptz;
begin
  if p_project_id is null
    or p_auth_user_id is null
    or p_rating is null
    or p_rating not between 1 and 5
    or p_review is null
    or pg_catalog.char_length(pg_catalog.btrim(p_review)) not between 20 and 1200
  then
    return pg_catalog.jsonb_build_object('outcome', 'invalid_review');
  end if;

  select project.client_id, project.status, client.name
  into v_client_id, v_project_status, v_client_name
  from public.client_projects project
  join public.clients client on client.id = project.client_id
  where project.id = p_project_id
    and client.auth_user_id = p_auth_user_id
    and client.status = 'active'
    and exists (
      select 1
      from auth.users auth_user
      where auth_user.id = p_auth_user_id
        and auth_user.email_confirmed_at is not null
    )
  for update of project;

  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;
  if v_project_status <> 'completed' then
    return pg_catalog.jsonb_build_object('outcome', 'project_not_completed');
  end if;

  insert into public.project_reviews (
    name, rating, review, status, display_order, client_id, client_project_id
  )
  values (
    v_client_name,
    p_rating,
    pg_catalog.btrim(p_review),
    'pending',
    100000,
    v_client_id,
    p_project_id
  )
  on conflict (client_project_id) where client_project_id is not null
  do nothing
  returning id, created_at into v_review_id, v_created_at;

  if v_review_id is null then
    return pg_catalog.jsonb_build_object('outcome', 'already_submitted');
  end if;

  insert into public.project_activity (project_id, event_type, actor_type, actor_id, details)
  values (
    p_project_id,
    'project_review_submitted',
    'client',
    p_auth_user_id,
    pg_catalog.jsonb_build_object('review_id', v_review_id)
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'submitted',
    'review_id', v_review_id,
    'status', 'pending',
    'rating', p_rating,
    'review', pg_catalog.btrim(p_review),
    'created_at', v_created_at
  );
end;
$$;

revoke all on function public.submit_completed_project_review(uuid, uuid, smallint, text)
  from public, anon, authenticated;
grant execute on function public.submit_completed_project_review(uuid, uuid, smallint, text)
  to service_role;
