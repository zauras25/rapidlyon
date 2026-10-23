alter table public.clients
  add column if not exists auth_user_id uuid unique
    references auth.users(id) on delete set null;

create policy clients_select_own
  on public.clients
  for select
  to authenticated
  using ((select auth.uid()) = auth_user_id);

create policy client_projects_select_own
  on public.client_projects
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.clients c
      where c.id = client_projects.client_id
        and c.auth_user_id = (select auth.uid())
        and c.status = 'active'
    )
  );

create policy project_milestones_select_own
  on public.project_milestones
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.client_projects cp
      join public.clients c on c.id = cp.client_id
      where cp.id = project_milestones.project_id
        and c.auth_user_id = (select auth.uid())
        and c.status = 'active'
    )
  );

create policy project_deliverables_select_own
  on public.project_deliverables
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.client_projects cp
      join public.clients c on c.id = cp.client_id
      where cp.id = project_deliverables.project_id
        and c.auth_user_id = (select auth.uid())
        and c.status = 'active'
    )
  );

create policy project_activity_select_own
  on public.project_activity
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.client_projects cp
      join public.clients c on c.id = cp.client_id
      where cp.id = project_activity.project_id
        and c.auth_user_id = (select auth.uid())
        and c.status = 'active'
    )
  );

grant select on public.clients, public.client_projects, public.project_milestones,
  public.project_deliverables, public.project_activity to authenticated;

revoke all on public.project_invitations from public, anon, authenticated;

create or replace function public.accept_project_invitation(
  p_token_hash text,
  p_auth_user_id uuid,
  p_auth_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.project_invitations%rowtype;
  v_client_email text;
  v_client_auth_user_id uuid;
begin
  if p_token_hash is null
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_auth_user_id is null
    or p_auth_email is null
  then
    return null;
  end if;

  select i.*
  into v_invitation
  from public.project_invitations i
  where i.token_hash = p_token_hash
  for update;

  if not found or v_invitation.status <> 'pending' then
    return null;
  end if;

  if v_invitation.expires_at <= pg_catalog.clock_timestamp() then
    update public.project_invitations
    set status = 'expired',
        updated_at = pg_catalog.clock_timestamp()
    where id = v_invitation.id
      and status = 'pending';
    return null;
  end if;

  select c.email, c.auth_user_id
  into v_client_email, v_client_auth_user_id
  from public.clients c
  where c.id = v_invitation.client_id
    and c.status = 'active'
  for update;

  if not found
    or pg_catalog.lower(pg_catalog.btrim(v_invitation.email)) <> pg_catalog.lower(pg_catalog.btrim(p_auth_email))
    or pg_catalog.lower(pg_catalog.btrim(v_client_email)) <> pg_catalog.lower(pg_catalog.btrim(p_auth_email))
    or (v_client_auth_user_id is not null and v_client_auth_user_id <> p_auth_user_id)
    or not exists (
      select 1
      from public.client_projects project
      where project.id = v_invitation.project_id
        and project.client_id = v_invitation.client_id
        and project.status = 'invited'
    )
    or exists (
      select 1
      from public.clients other_client
      where other_client.auth_user_id = p_auth_user_id
        and other_client.id <> v_invitation.client_id
    )
  then
    return null;
  end if;

  begin
    update public.clients
    set auth_user_id = p_auth_user_id,
        updated_at = pg_catalog.clock_timestamp()
    where id = v_invitation.client_id
      and (auth_user_id is null or auth_user_id = p_auth_user_id);
  exception
    when unique_violation then
      return null;
  end;

  update public.project_invitations
  set status = 'accepted',
      accepted_at = pg_catalog.clock_timestamp(),
      updated_at = pg_catalog.clock_timestamp()
  where id = v_invitation.id
    and status = 'pending';

  if not found then
    return null;
  end if;

  update public.client_projects
  set status = 'active',
      updated_at = pg_catalog.clock_timestamp()
  where id = v_invitation.project_id
    and client_id = v_invitation.client_id
    and status = 'invited';

  insert into public.project_activity (
    project_id,
    event_type,
    actor_type,
    actor_id,
    details
  )
  values (
    v_invitation.project_id,
    'invitation_accepted',
    'client',
    p_auth_user_id,
    pg_catalog.jsonb_build_object('invitation_id', v_invitation.id)
  );

  return v_invitation.project_id;
end;
$$;

revoke all on function public.accept_project_invitation(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.accept_project_invitation(text, uuid, text)
  to service_role;
