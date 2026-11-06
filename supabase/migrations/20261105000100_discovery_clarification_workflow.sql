alter table public.discovery_submissions
  add column if not exists scope_readiness_status text not null default 'not_reviewed',
  add column if not exists scope_readiness_reason text not null default '',
  add column if not exists scope_readiness_updated_at timestamptz;

alter table public.discovery_submissions
  drop constraint if exists discovery_submissions_scope_readiness_status_check;
alter table public.discovery_submissions
  add constraint discovery_submissions_scope_readiness_status_check
  check (scope_readiness_status in ('not_reviewed','more_information','ready','not_a_fit'));

update public.discovery_submissions
set scope_readiness_status = 'ready',
    scope_readiness_reason = 'Previously qualified for scope preparation.',
    scope_readiness_updated_at = coalesce(updated_at, created_at)
where (qualification_status = 'qualified' or client_project_id is not null)
  and scope_readiness_status = 'not_reviewed';

create table if not exists public.discovery_clarification_invitations (
  id uuid primary key default gen_random_uuid(),
  discovery_id uuid not null references public.discovery_submissions(id) on delete restrict,
  version integer not null check (version > 0),
  message text not null check (char_length(message) between 20 and 5000),
  offered_methods text[] not null check (
    cardinality(offered_methods) between 1 and 5
    and offered_methods <@ array['whatsapp','voice','video','moderated','unmoderated']::text[]
  ),
  status text not null default 'draft' check (status in ('draft','sent','failed','responded','expired')),
  token_hash text unique,
  expires_at timestamptz not null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (discovery_id, version)
);
create index if not exists discovery_clarification_discovery_idx
  on public.discovery_clarification_invitations(discovery_id, version desc);
create index if not exists discovery_clarification_active_token_idx
  on public.discovery_clarification_invitations(token_hash, expires_at)
  where status in ('sent','responded');

create table if not exists public.discovery_clarification_questions (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.discovery_clarification_invitations(id) on delete restrict,
  category text not null default 'general' check (char_length(category) between 1 and 80),
  source_key text,
  prompt text not null check (char_length(prompt) between 1 and 1000),
  status text not null default 'draft' check (status in ('draft','sent','answered','closed')),
  answer text check (answer is null or char_length(answer) <= 5000),
  close_reason text check (close_reason is null or char_length(close_reason) <= 2000),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists discovery_clarification_questions_invite_idx
  on public.discovery_clarification_questions(invitation_id, created_at);

create table if not exists public.discovery_service_reviews (
  discovery_id uuid not null references public.discovery_submissions(id) on delete restrict,
  service text not null check (char_length(service) between 1 and 120),
  result text not null check (result in ('suitable','more_information','not_suitable')),
  reason text not null check (char_length(reason) between 12 and 2000),
  updated_at timestamptz not null default now(),
  primary key (discovery_id, service)
);

create table if not exists public.discovery_research_sessions (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.discovery_clarification_invitations(id) on delete restrict,
  method text not null check (method in ('whatsapp','voice','video','moderated','unmoderated')),
  status text not null default 'selected' check (
    status in ('selected','planned','awaiting_confirmation','confirmed','reschedule_requested','completed')
  ),
  preferred_time text check (preferred_time is null or char_length(preferred_time) <= 200),
  client_note text check (client_note is null or char_length(client_note) <= 2000),
  client_confirmed_services text[] not null default '{}'::text[] check (
    cardinality(client_confirmed_services) <= 3
    and client_confirmed_services <@ array['Product Design','Next.js Development','SEO']::text[]
  ),
  reschedule_note text check (reschedule_note is null or char_length(reschedule_note) <= 2000),
  planned_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 5 and 1440),
  owner text check (owner is null or char_length(owner) <= 160),
  agenda text check (agenda is null or char_length(agenda) <= 5000),
  access_details text check (access_details is null or char_length(access_details) <= 1000),
  confirmation_token_hash text unique,
  confirmation_expires_at timestamptz,
  confirmed_at timestamptz,
  findings text check (findings is null or char_length(findings) <= 10000),
  outcome text check (outcome is null or char_length(outcome) <= 5000),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists discovery_research_sessions_status_idx
  on public.discovery_research_sessions(status, planned_at);

create table if not exists public.discovery_workflow_events (
  id bigint generated always as identity primary key,
  discovery_id uuid not null references public.discovery_submissions(id) on delete restrict,
  invitation_id uuid references public.discovery_clarification_invitations(id) on delete restrict,
  session_id uuid references public.discovery_research_sessions(id) on delete restrict,
  actor text not null check (actor in ('admin','client','system')),
  event_type text not null check (char_length(event_type) between 1 and 100),
  summary text not null check (char_length(summary) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists discovery_workflow_events_recent_idx
  on public.discovery_workflow_events(discovery_id, created_at desc, id desc);

update public.discovery_submissions submission
set scope_readiness_status = 'ready',
    scope_readiness_reason = 'Previously qualified or already scoped before the readiness workflow was added.',
    scope_readiness_updated_at = coalesce(submission.updated_at, submission.created_at)
where submission.scope_readiness_status = 'not_reviewed'
  and (
    submission.qualification_status = 'qualified'
    or submission.status in ('Discovery Completed','Proposal In Progress')
    or exists (select 1 from public.discovery_work_scopes scope where scope.discovery_id = submission.id)
  );

alter table public.discovery_submissions
  drop constraint if exists discovery_submissions_project_requires_scope_readiness;
alter table public.discovery_submissions
  add constraint discovery_submissions_project_requires_scope_readiness
  check (client_project_id is null or scope_readiness_status = 'ready') not valid;
alter table public.discovery_submissions
  validate constraint discovery_submissions_project_requires_scope_readiness;

create or replace function public.guard_discovery_scope_readiness() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.discovery_submissions submission
  where submission.id = new.discovery_id and submission.scope_readiness_status = 'ready'
  for share;
  if not found then raise exception 'discovery_scope_readiness_required'; end if;
  return new;
end;
$$;
revoke all on function public.guard_discovery_scope_readiness() from public, anon, authenticated;
drop trigger if exists discovery_work_scope_readiness on public.discovery_work_scopes;
create trigger discovery_work_scope_readiness before insert on public.discovery_work_scopes
for each row execute function public.guard_discovery_scope_readiness();

alter table public.discovery_clarification_invitations enable row level security;
alter table public.discovery_clarification_questions enable row level security;
alter table public.discovery_service_reviews enable row level security;
alter table public.discovery_research_sessions enable row level security;
alter table public.discovery_workflow_events enable row level security;
revoke all on public.discovery_clarification_invitations from public, anon, authenticated;
revoke all on public.discovery_clarification_questions from public, anon, authenticated;
revoke all on public.discovery_service_reviews from public, anon, authenticated;
revoke all on public.discovery_research_sessions from public, anon, authenticated;
revoke all on public.discovery_workflow_events from public, anon, authenticated;
grant select, insert, update on public.discovery_clarification_invitations to service_role;
grant select, insert, update on public.discovery_clarification_questions to service_role;
grant select, insert, update on public.discovery_service_reviews to service_role;
grant select, insert, update on public.discovery_research_sessions to service_role;
grant select, insert on public.discovery_workflow_events to service_role;
grant usage, select on sequence public.discovery_workflow_events_id_seq to service_role;

create or replace function public.create_discovery_clarification_invitation(
  p_discovery_id uuid,
  p_message text,
  p_offered_methods text[],
  p_questions jsonb,
  p_token_hash text,
  p_expires_at timestamptz
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_invitation_id uuid;
  v_version integer;
  v_question jsonb;
begin
  if p_message is null or pg_catalog.char_length(pg_catalog.btrim(p_message)) not between 20 and 5000
    or p_offered_methods is null or pg_catalog.cardinality(p_offered_methods) not between 1 and 5
    or not (p_offered_methods <@ array['whatsapp','voice','video','moderated','unmoderated']::text[])
    or p_questions is null or pg_catalog.jsonb_typeof(p_questions) is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_questions) not between 1 and 30
    or p_token_hash is null or pg_catalog.char_length(p_token_hash) not between 40 and 128
    or p_expires_at <= pg_catalog.clock_timestamp()
  then
    raise exception 'invalid_discovery_clarification';
  end if;

  perform 1 from public.discovery_submissions
  where id = p_discovery_id and archived_at is null and client_project_id is null
  for update;
  if not found then raise exception 'discovery_not_available'; end if;
  if exists (
    select 1 from public.discovery_research_sessions session
    join public.discovery_clarification_invitations invitation on invitation.id = session.invitation_id
    where invitation.discovery_id = p_discovery_id and session.status <> 'completed'
  ) then raise exception 'active_research_session'; end if;

  update public.discovery_clarification_questions question
  set status = 'closed', close_reason = 'Superseded by a newer clarification invitation.',
      closed_at = pg_catalog.clock_timestamp(), updated_at = pg_catalog.clock_timestamp()
  from public.discovery_clarification_invitations invitation
  where invitation.id = question.invitation_id and invitation.discovery_id = p_discovery_id
    and question.status in ('draft','sent');
  update public.discovery_clarification_invitations
  set status = 'expired', updated_at = pg_catalog.clock_timestamp()
  where discovery_id = p_discovery_id and status in ('draft','sent','failed','responded');

  select coalesce(max(version), 0) + 1 into v_version
  from public.discovery_clarification_invitations
  where discovery_id = p_discovery_id;

  insert into public.discovery_clarification_invitations(
    discovery_id, version, message, offered_methods, token_hash, expires_at
  ) values (
    p_discovery_id, v_version, pg_catalog.btrim(p_message), p_offered_methods, p_token_hash, p_expires_at
  ) returning id into v_invitation_id;

  for v_question in select value from pg_catalog.jsonb_array_elements(p_questions)
  loop
    if pg_catalog.jsonb_typeof(v_question) is distinct from 'object'
      or pg_catalog.char_length(pg_catalog.btrim(coalesce(v_question->>'prompt',''))) not between 1 and 1000
      or pg_catalog.char_length(coalesce(v_question->>'category','general')) not between 1 and 80
    then raise exception 'invalid_discovery_question'; end if;
    insert into public.discovery_clarification_questions(
      invitation_id, category, source_key, prompt, status
    ) values (
      v_invitation_id,
      coalesce(nullif(pg_catalog.btrim(v_question->>'category'), ''), 'general'),
      nullif(pg_catalog.btrim(v_question->>'source_key'), ''),
      pg_catalog.btrim(v_question->>'prompt'),
      'draft'
    );
  end loop;

  insert into public.discovery_workflow_events(discovery_id, invitation_id, actor, event_type, summary)
  values (p_discovery_id, v_invitation_id, 'admin', 'clarification_prepared', 'Clarification invitation prepared.');
  return v_invitation_id;
end;
$$;

create or replace function public.set_discovery_clarification_delivery(
  p_invitation_id uuid,
  p_delivery_status text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_invitation public.discovery_clarification_invitations%rowtype;
begin
  if p_delivery_status not in ('sent','failed') then raise exception 'invalid_delivery_status'; end if;
  select * into v_invitation from public.discovery_clarification_invitations
  where id = p_invitation_id for update;
  if not found or v_invitation.status <> 'draft' then raise exception 'invitation_not_available'; end if;

  update public.discovery_clarification_invitations
  set status = p_delivery_status, updated_at = pg_catalog.clock_timestamp()
  where id = p_invitation_id;
  if p_delivery_status = 'sent' then
    update public.discovery_clarification_questions
    set status = 'sent', updated_at = pg_catalog.clock_timestamp()
    where invitation_id = p_invitation_id and status = 'draft';
    update public.discovery_submissions
    set status = 'Awaiting Client Information',
      qualification_status = 'unqualified',
        next_action = 'Review the client clarification response',
      scope_readiness_status = 'not_reviewed',
      scope_readiness_reason = '',
      scope_readiness_updated_at = null,
        updated_at = pg_catalog.clock_timestamp()
    where id = v_invitation.discovery_id and client_project_id is null;
    delete from public.discovery_service_reviews where discovery_id = v_invitation.discovery_id;
  end if;
  insert into public.discovery_workflow_events(discovery_id, invitation_id, actor, event_type, summary)
  values (
    v_invitation.discovery_id, p_invitation_id, 'system',
    case when p_delivery_status = 'sent' then 'clarification_sent' else 'clarification_delivery_failed' end,
    case when p_delivery_status = 'sent' then 'Clarification invitation accepted by email provider.' else 'Clarification invitation email was not accepted by the provider.' end
  );
  return true;
end;
$$;

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
    or pg_catalog.jsonb_object_length(p_answers) > 30
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

create or replace function public.save_discovery_session_plan(
  p_discovery_id uuid,
  p_session_id uuid,
  p_planned_at timestamptz,
  p_duration_minutes integer,
  p_owner text,
  p_agenda text,
  p_access_details text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_session public.discovery_research_sessions%rowtype;
begin
  if p_planned_at <= pg_catalog.clock_timestamp()
    or p_duration_minutes not between 5 and 1440
    or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_owner,''))) not between 2 and 160
    or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_agenda,''))) not between 20 and 5000
    or pg_catalog.char_length(coalesce(p_access_details,'')) > 1000
  then raise exception 'invalid_discovery_session_plan'; end if;
  perform 1 from public.discovery_submissions submission
  where submission.id = p_discovery_id and submission.archived_at is null for update;
  if not found then raise exception 'discovery_not_found'; end if;
  select session.* into v_session
  from public.discovery_research_sessions session
  join public.discovery_clarification_invitations invitation on invitation.id = session.invitation_id
  where session.id = p_session_id and invitation.discovery_id = p_discovery_id for update of session;
  if not found or v_session.status not in ('selected','planned','reschedule_requested') then
    raise exception 'session_not_available_for_planning';
  end if;
  update public.discovery_research_sessions
  set planned_at = p_planned_at, duration_minutes = p_duration_minutes,
      owner = pg_catalog.btrim(p_owner), agenda = pg_catalog.btrim(p_agenda),
      access_details = nullif(pg_catalog.btrim(p_access_details), ''), status = 'planned',
      updated_at = pg_catalog.clock_timestamp()
  where id = p_session_id;
  insert into public.discovery_workflow_events(discovery_id, invitation_id, session_id, actor, event_type, summary)
  values (p_discovery_id, v_session.invitation_id, p_session_id, 'admin', 'session_plan_saved', 'Admin saved a proposed session plan.');
  return true;
end;
$$;

create or replace function public.request_discovery_session_confirmation(p_session_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_session public.discovery_research_sessions%rowtype;
begin
  select * into v_session from public.discovery_research_sessions where id = p_session_id for update;
  if not found or v_session.status <> 'planned' then raise exception 'session_not_ready_for_confirmation'; end if;
  update public.discovery_research_sessions
  set status = 'awaiting_confirmation', updated_at = pg_catalog.clock_timestamp()
  where id = p_session_id;
  insert into public.discovery_workflow_events(discovery_id, invitation_id, session_id, actor, event_type, summary)
  select invitation.discovery_id, invitation.id, p_session_id, 'admin', 'session_confirmation_requested', 'Admin requested client confirmation of the session plan.'
  from public.discovery_clarification_invitations invitation where invitation.id = v_session.invitation_id;
  return true;
end;
$$;

create or replace function public.request_discovery_session_confirmation_with_link(
  p_discovery_id uuid,
  p_session_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_invitation_id uuid;
begin
  if p_token_hash is null or pg_catalog.char_length(p_token_hash) <> 64
    or p_expires_at <= pg_catalog.clock_timestamp()
  then raise exception 'invalid_session_confirmation_link'; end if;
  perform 1 from public.discovery_submissions submission
  where submission.id = p_discovery_id and submission.archived_at is null for update;
  if not found then raise exception 'discovery_not_found'; end if;
  select session.invitation_id into v_invitation_id
  from public.discovery_research_sessions session
  join public.discovery_clarification_invitations invitation on invitation.id = session.invitation_id
  where session.id = p_session_id and invitation.discovery_id = p_discovery_id
    and session.status in ('planned','awaiting_confirmation') and invitation.status = 'responded'
  for update of session;
  if not found then raise exception 'session_not_ready_for_confirmation'; end if;
  update public.discovery_research_sessions
  set status = 'awaiting_confirmation', updated_at = pg_catalog.clock_timestamp()
  where id = p_session_id;
  update public.discovery_clarification_invitations
  set token_hash = p_token_hash, expires_at = p_expires_at, updated_at = pg_catalog.clock_timestamp()
  where id = v_invitation_id;
  insert into public.discovery_workflow_events(discovery_id, invitation_id, session_id, actor, event_type, summary)
  values (p_discovery_id, v_invitation_id, p_session_id, 'admin', 'session_confirmation_requested', 'Admin requested client confirmation of the session plan.');
  return p_discovery_id;
end;
$$;

create or replace function public.update_discovery_clarification_question(
  p_discovery_id uuid,
  p_question_id uuid,
  p_action text,
  p_reason text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_invitation_id uuid; v_prompt text; v_status text; v_invitation_status text;
begin
  if p_action not in ('close','reopen')
    or pg_catalog.char_length(coalesce(p_reason,'')) > 2000
    or (p_action = 'close' and pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason,''))) < 12)
  then raise exception 'invalid_discovery_question_action'; end if;

  perform 1 from public.discovery_submissions submission
  where submission.id = p_discovery_id and submission.archived_at is null for update;
  if not found then raise exception 'discovery_not_found'; end if;

  select question.invitation_id, question.prompt, question.status, invitation.status
  into v_invitation_id, v_prompt, v_status, v_invitation_status
  from public.discovery_clarification_questions question
  join public.discovery_clarification_invitations invitation on invitation.id = question.invitation_id
  where question.id = p_question_id and invitation.discovery_id = p_discovery_id
  for update of question;
  if not found then raise exception 'discovery_question_not_found'; end if;
  if p_action = 'close' then
    if v_status not in ('draft','sent') then raise exception 'discovery_question_not_open'; end if;
    update public.discovery_clarification_questions
    set status = 'closed', close_reason = pg_catalog.btrim(p_reason), closed_at = pg_catalog.clock_timestamp(), updated_at = pg_catalog.clock_timestamp()
    where id = p_question_id;
  else
    if v_status <> 'closed' then raise exception 'discovery_question_not_closed'; end if;
    if v_invitation_status = 'responded' then raise exception 'create_a_followup_invitation_instead'; end if;
    update public.discovery_clarification_questions
    set status = case when v_invitation_status = 'sent' then 'sent' else 'draft' end,
        close_reason = null, closed_at = null, updated_at = pg_catalog.clock_timestamp()
    where id = p_question_id;
  end if;
  insert into public.discovery_workflow_events(discovery_id, invitation_id, actor, event_type, summary)
  values (p_discovery_id, v_invitation_id, 'admin',
    case when p_action = 'close' then 'question_closed' else 'question_reopened' end,
    case when p_action = 'close' then 'Admin closed a question: ' || pg_catalog.left(v_prompt, 500) || '. Reason: ' || pg_catalog.left(pg_catalog.btrim(p_reason), 1000)
      else 'Admin reopened a clarification question: ' || pg_catalog.left(v_prompt, 500) end);
  return true;
end;
$$;

create or replace function public.save_discovery_service_review(
  p_discovery_id uuid,
  p_service text,
  p_result text,
  p_reason text
) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_service is null or pg_catalog.char_length(pg_catalog.btrim(p_service)) not between 1 and 120
    or p_result not in ('suitable','more_information','not_suitable')
    or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason,''))) not between 12 and 2000
  then raise exception 'invalid_discovery_service_review'; end if;
  perform 1 from public.discovery_submissions submission
  where submission.id = p_discovery_id and submission.archived_at is null for update;
  if not found then raise exception 'discovery_not_found'; end if;
  if not exists (
    select 1 from public.discovery_submissions submission
    where submission.id = p_discovery_id and submission.archived_at is null
      and submission.services @> pg_catalog.jsonb_build_array(pg_catalog.btrim(p_service))
  ) and not exists (
    select 1
    from public.discovery_research_sessions session
    join public.discovery_clarification_invitations invitation on invitation.id = session.invitation_id
    where invitation.discovery_id = p_discovery_id
      and invitation.version = (select pg_catalog.max(latest.version) from public.discovery_clarification_invitations latest where latest.discovery_id = p_discovery_id)
      and session.client_confirmed_services @> array[pg_catalog.btrim(p_service)]::text[]
  ) then raise exception 'service_not_selected_for_discovery'; end if;
  insert into public.discovery_service_reviews(discovery_id,service,result,reason,updated_at)
  values (p_discovery_id,pg_catalog.btrim(p_service),p_result,pg_catalog.btrim(p_reason),pg_catalog.clock_timestamp())
  on conflict (discovery_id,service) do update
  set result = excluded.result, reason = excluded.reason, updated_at = excluded.updated_at;
  insert into public.discovery_workflow_events(discovery_id,actor,event_type,summary)
  values (p_discovery_id,'admin','service_review_saved','Service review recorded for ' || pg_catalog.left(pg_catalog.btrim(p_service),120) || ': ' || p_result || '.');
  return true;
end;
$$;

create or replace function public.respond_discovery_session_confirmation(
  p_discovery_id uuid,
  p_invitation_id uuid,
  p_session_id uuid,
  p_action text,
  p_reschedule_note text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_invitation_id uuid;
begin
  if p_action not in ('confirm','reschedule') or pg_catalog.char_length(coalesce(p_reschedule_note,'')) > 2000
    or (p_action = 'reschedule' and pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reschedule_note,''))) < 5)
  then raise exception 'invalid_session_confirmation'; end if;
  update public.discovery_research_sessions session
  set status = case when p_action = 'confirm' then 'confirmed' else 'reschedule_requested' end,
      confirmed_at = case when p_action = 'confirm' then pg_catalog.clock_timestamp() else null end,
      reschedule_note = case when p_action = 'reschedule' then pg_catalog.btrim(p_reschedule_note) else null end,
      updated_at = pg_catalog.clock_timestamp()
  from public.discovery_clarification_invitations invitation
  where session.id = p_session_id and session.invitation_id = invitation.id
    and invitation.id = p_invitation_id and invitation.discovery_id = p_discovery_id and invitation.status = 'responded'
    and invitation.expires_at > pg_catalog.clock_timestamp()
    and session.status = 'awaiting_confirmation'
  returning session.invitation_id into v_invitation_id;
  if not found then raise exception 'session_confirmation_unavailable'; end if;
  insert into public.discovery_workflow_events(discovery_id, invitation_id, session_id, actor, event_type, summary)
  values (p_discovery_id, v_invitation_id, p_session_id, 'client',
    case when p_action = 'confirm' then 'session_confirmed' else 'session_reschedule_requested' end,
    case when p_action = 'confirm' then 'Client confirmed the proposed session.' else 'Client asked to reschedule the proposed session.' end);
  return true;
end;
$$;

create or replace function public.complete_discovery_research_session(
  p_discovery_id uuid,
  p_session_id uuid,
  p_findings text,
  p_outcome text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_session public.discovery_research_sessions%rowtype;
begin
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_findings,''))) not between 15 and 10000
    or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_outcome,''))) not between 12 and 5000
  then raise exception 'invalid_discovery_findings'; end if;
  perform 1 from public.discovery_submissions submission
  where submission.id = p_discovery_id and submission.archived_at is null for update;
  if not found then raise exception 'discovery_not_found'; end if;
  select session.* into v_session
  from public.discovery_research_sessions session
  join public.discovery_clarification_invitations invitation on invitation.id = session.invitation_id
  where session.id = p_session_id and invitation.discovery_id = p_discovery_id for update of session;
  if not found or v_session.status <> 'confirmed' then raise exception 'session_must_be_confirmed'; end if;
  update public.discovery_research_sessions
  set findings = pg_catalog.btrim(p_findings), outcome = pg_catalog.btrim(p_outcome),
      status = 'completed', completed_at = pg_catalog.clock_timestamp(), updated_at = pg_catalog.clock_timestamp()
  where id = p_session_id;
  insert into public.discovery_workflow_events(discovery_id, invitation_id, session_id, actor, event_type, summary)
  values (p_discovery_id, v_session.invitation_id, p_session_id, 'admin', 'session_completed', 'Admin recorded research findings and completed the session.');
  return true;
end;
$$;

create or replace function public.set_discovery_scope_readiness(
  p_discovery_id uuid,
  p_status text,
  p_reason text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_open_questions integer; v_pending_session integer; v_unreviewed_services integer; v_services jsonb; v_effective_services jsonb; v_confirmed_services text[]; v_project_id uuid;
begin
  if p_status not in ('more_information','ready','not_a_fit')
    or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason,''))) not between 15 and 5000
  then raise exception 'invalid_scope_readiness'; end if;

  select services, client_project_id into v_services, v_project_id from public.discovery_submissions
  where id = p_discovery_id and archived_at is null for update;
  if not found then raise exception 'discovery_not_found'; end if;
  if v_project_id is not null then raise exception 'discovery_project_already_created'; end if;
  select session.client_confirmed_services into v_confirmed_services
  from public.discovery_research_sessions session
  join public.discovery_clarification_invitations invitation on invitation.id = session.invitation_id
  where invitation.discovery_id = p_discovery_id
  order by invitation.version desc limit 1;
  if p_status = 'ready' and v_services @> pg_catalog.jsonb_build_array('Other / not sure yet')
    and coalesce(pg_catalog.cardinality(v_confirmed_services),0) = 0
  then raise exception 'client_service_choice_required'; end if;
  if v_services @> pg_catalog.jsonb_build_array('Other / not sure yet') then
    select coalesce(pg_catalog.jsonb_agg(selected_service.value), '[]'::jsonb)
    into v_effective_services
    from (
      select original.value
      from pg_catalog.jsonb_array_elements_text(v_services) as original(value)
      where original.value <> 'Other / not sure yet'
      union
      select pg_catalog.unnest(coalesce(v_confirmed_services, '{}'::text[])) as value
    ) selected_service;
  else
    v_effective_services := v_services;
  end if;
  select count(*) into v_open_questions
  from public.discovery_clarification_questions question
  join public.discovery_clarification_invitations invitation on invitation.id = question.invitation_id
  where invitation.discovery_id = p_discovery_id and question.status in ('draft','sent');
  if p_status = 'ready' and v_open_questions > 0 then raise exception 'discovery_questions_unresolved'; end if;

  select count(*) into v_pending_session
  from public.discovery_research_sessions session
  join public.discovery_clarification_invitations invitation on invitation.id = session.invitation_id
  where invitation.discovery_id = p_discovery_id and session.status <> 'completed';
  if p_status = 'ready' and v_pending_session > 0 then raise exception 'discovery_session_incomplete'; end if;

  select count(*) into v_unreviewed_services
  from pg_catalog.jsonb_array_elements_text(coalesce(v_effective_services,'[]'::jsonb)) as selected_service(value)
  left join public.discovery_service_reviews review
    on review.discovery_id = p_discovery_id and review.service = selected_service.value
  where review.result is distinct from 'suitable';
  if p_status = 'ready' and v_unreviewed_services > 0 then raise exception 'discovery_services_not_reviewed'; end if;

  update public.discovery_submissions
  set scope_readiness_status = p_status,
      scope_readiness_reason = pg_catalog.btrim(p_reason),
      scope_readiness_updated_at = pg_catalog.clock_timestamp(),
      status = case p_status when 'ready' then 'Discovery Completed' when 'more_information' then 'Awaiting Client Information' else 'Closed' end,
      next_action = case p_status when 'ready' then 'Prepare a written scope and proposal' when 'more_information' then 'Request the remaining client information' else 'Request closed after fit review' end,
      updated_at = pg_catalog.clock_timestamp()
  where id = p_discovery_id;
  insert into public.discovery_workflow_events(discovery_id, actor, event_type, summary)
  values (p_discovery_id, 'admin', 'scope_readiness_recorded', 'Scope readiness: ' || p_status || '. ' || pg_catalog.left(pg_catalog.btrim(p_reason), 1800));
  return true;
end;
$$;

revoke all on function public.create_discovery_clarification_invitation(uuid,text,text[],jsonb,text,timestamptz) from public, anon, authenticated;
revoke all on function public.set_discovery_clarification_delivery(uuid,text) from public, anon, authenticated;
revoke all on function public.submit_discovery_clarification_response(text,text,jsonb,text[],text,text) from public, anon, authenticated;
revoke all on function public.save_discovery_session_plan(uuid,uuid,timestamptz,integer,text,text,text) from public, anon, authenticated;
revoke all on function public.request_discovery_session_confirmation(uuid) from public, anon, authenticated;
revoke all on function public.request_discovery_session_confirmation_with_link(uuid,uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.update_discovery_clarification_question(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.save_discovery_service_review(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.respond_discovery_session_confirmation(uuid,uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.complete_discovery_research_session(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.set_discovery_scope_readiness(uuid,text,text) from public, anon, authenticated;
grant execute on function public.create_discovery_clarification_invitation(uuid,text,text[],jsonb,text,timestamptz) to service_role;
grant execute on function public.set_discovery_clarification_delivery(uuid,text) to service_role;
grant execute on function public.submit_discovery_clarification_response(text,text,jsonb,text[],text,text) to service_role;
grant execute on function public.save_discovery_session_plan(uuid,uuid,timestamptz,integer,text,text,text) to service_role;
grant execute on function public.request_discovery_session_confirmation(uuid) to service_role;
grant execute on function public.request_discovery_session_confirmation_with_link(uuid,uuid,text,timestamptz) to service_role;
grant execute on function public.update_discovery_clarification_question(uuid,uuid,text,text) to service_role;
grant execute on function public.save_discovery_service_review(uuid,text,text,text) to service_role;
grant execute on function public.respond_discovery_session_confirmation(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.complete_discovery_research_session(uuid,uuid,text,text) to service_role;
grant execute on function public.set_discovery_scope_readiness(uuid,text,text) to service_role;