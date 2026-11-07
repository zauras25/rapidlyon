create or replace function public.submit_discovery_clarification_response(
  p_token_hash text,
  p_method text,
  p_answers jsonb,
  p_confirmed_services text[],
  p_preferred_time text,
  p_client_note text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_invitation public.discovery_clarification_invitations%rowtype;
  v_session_id uuid;
  v_answer record;
  v_updated integer;
begin
  if p_method not in ('whatsapp','voice','video','moderated','unmoderated')
    or p_answers is null or pg_catalog.jsonb_typeof(p_answers) is distinct from 'object'
    or (select count(*) from pg_catalog.jsonb_object_keys(p_answers)) > 30
    or p_confirmed_services is null or pg_catalog.cardinality(p_confirmed_services) > 3
    or not (p_confirmed_services <@ array['Product Design','Next.js Development','SEO']::text[])
    or pg_catalog.char_length(coalesce(p_preferred_time,'')) > 200
    or pg_catalog.char_length(coalesce(p_client_note,'')) > 2000
  then raise exception 'invalid_discovery_response'; end if;

  select * into v_invitation from public.discovery_clarification_invitations
  where token_hash = p_token_hash for update;
  if not found or v_invitation.status <> 'sent' or v_invitation.expires_at <= pg_catalog.clock_timestamp()
    then raise exception 'clarification_link_unavailable'; end if;
  if not (p_method = any(v_invitation.offered_methods)) then raise exception 'method_not_offered'; end if;

  for v_answer in select key, value from pg_catalog.jsonb_each_text(p_answers)
  loop
    update public.discovery_clarification_questions
    set answer = pg_catalog.left(pg_catalog.btrim(v_answer.value), 5000),
        status = 'answered', updated_at = pg_catalog.clock_timestamp()
    where id = v_answer.key::uuid and invitation_id = v_invitation.id and status = 'sent'
      and pg_catalog.char_length(pg_catalog.btrim(v_answer.value)) > 0;
    get diagnostics v_updated = row_count;
    if v_updated = 0 and not exists (
      select 1 from public.discovery_clarification_questions
      where id = v_answer.key::uuid and invitation_id = v_invitation.id and status in ('answered','closed')
    ) then raise exception 'question_not_available'; end if;
  end loop;

  insert into public.discovery_research_sessions(
    invitation_id, method, status, preferred_time, client_note, client_confirmed_services
  ) values (
    v_invitation.id, p_method, 'selected', nullif(pg_catalog.btrim(p_preferred_time), ''),
    nullif(pg_catalog.btrim(p_client_note), ''), p_confirmed_services
  ) returning id into v_session_id;
  update public.discovery_clarification_invitations
  set status = 'responded', responded_at = pg_catalog.clock_timestamp(), updated_at = pg_catalog.clock_timestamp()
  where id = v_invitation.id;
  insert into public.discovery_workflow_events(discovery_id, invitation_id, session_id, actor, event_type, summary)
  values (v_invitation.discovery_id, v_invitation.id, v_session_id, 'client', 'client_responded', 'Client submitted clarification answers and selected a discussion method.');
  return v_session_id;
end;
$$;

revoke all on function public.submit_discovery_clarification_response(
  text,text,jsonb,text[],text,text
) from public, anon, authenticated;

grant execute on function public.submit_discovery_clarification_response(
  text,text,jsonb,text[],text,text
) to service_role;
