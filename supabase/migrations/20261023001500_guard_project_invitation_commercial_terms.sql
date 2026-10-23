create or replace function public.create_project_invitation(
  p_project_id uuid,
  p_token_hash text,
  p_email text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.client_projects%rowtype;
  v_client public.clients%rowtype;
  v_invitation_id uuid;
begin
  if p_project_id is null
    or p_token_hash is null
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_email is null
    or pg_catalog.btrim(p_email) = ''
    or p_expires_at is null
    or p_expires_at <= pg_catalog.clock_timestamp()
  then
    return null;
  end if;

  select *
  into v_project
  from public.client_projects
  where id = p_project_id
  for update;

  if not found or v_project.status <> 'draft' then
    return null;
  end if;

  if v_project.package_key is null
    or pg_catalog.btrim(v_project.package_key) = ''
    or v_project.agreed_price is null
    or v_project.currency is null
    or pg_catalog.btrim(v_project.currency) = ''
    or pg_catalog.jsonb_typeof(v_project.package_snapshot) <> 'object'
    or v_project.package_snapshot = '{}'::jsonb
    or pg_catalog.jsonb_typeof(v_project.agreed_scope) <> 'object'
    or v_project.agreed_scope = '{}'::jsonb
  then
    return null;
  end if;

  select *
  into v_client
  from public.clients
  where id = v_project.client_id
    and status = 'active'
  for update;

  if not found
    or pg_catalog.lower(pg_catalog.btrim(v_client.email))
       <> pg_catalog.lower(pg_catalog.btrim(p_email))
  then
    return null;
  end if;

  if exists (
    select 1
    from public.project_invitations i
    where i.project_id = v_project.id
      and i.status = 'pending'
      and i.expires_at > pg_catalog.clock_timestamp()
  ) then
    return null;
  end if;

  insert into public.project_invitations (
    client_id,
    project_id,
    email,
    token_hash,
    status,
    expires_at
  )
  values (
    v_client.id,
    v_project.id,
    pg_catalog.btrim(v_client.email),
    p_token_hash,
    'pending',
    p_expires_at
  )
  returning id into v_invitation_id;

  update public.client_projects
  set
    status = 'invited',
    updated_at = pg_catalog.clock_timestamp()
  where id = v_project.id
    and status = 'draft';

  if not found then
    return null;
  end if;

  insert into public.project_activity (
    project_id,
    event_type,
    actor_type,
    details
  )
  values (
    v_project.id,
    'invitation_sent',
    'admin',
    pg_catalog.jsonb_build_object(
      'invitation_id', v_invitation_id,
      'recipient_email', pg_catalog.btrim(v_client.email),
      'expires_at', p_expires_at
    )
  );

  return v_invitation_id;
end;
$$;

revoke all on function public.create_project_invitation(
  uuid,
  text,
  text,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.create_project_invitation(
  uuid,
  text,
  text,
  timestamptz
) to service_role;
