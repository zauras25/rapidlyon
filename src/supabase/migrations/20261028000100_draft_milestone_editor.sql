-- Draft-only milestone editing. Executed through an authenticated admin API,
-- never granted to anon/authenticated roles.
create or replace function public.save_draft_project_milestone(
  p_project_id uuid,
  p_milestone_id uuid,
  p_title text,
  p_description text,
  p_due_date date
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_status text;
  v_milestone_id uuid;
  v_position integer;
  v_outcome text;
begin
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_title,''))) not between 1 and 200
    or pg_catalog.length(coalesce(p_description,'')) > 5000 then
    return pg_catalog.jsonb_build_object('outcome','invalid_request');
  end if;

  select status into v_project_status
  from public.client_projects where id=p_project_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('outcome','not_found');
  end if;
  if v_project_status <> 'draft' then
    return pg_catalog.jsonb_build_object('outcome','project_not_draft');
  end if;

  if p_milestone_id is null then
    select coalesce(pg_catalog.max(position),-1)+1 into v_position
    from public.project_milestones where project_id=p_project_id;
    insert into public.project_milestones(project_id,title,description,position,due_date)
    values(p_project_id,pg_catalog.btrim(p_title),coalesce(p_description,''),v_position,p_due_date)
    returning id into v_milestone_id;
    v_outcome := 'created';
  else
    update public.project_milestones
    set title=pg_catalog.btrim(p_title), description=coalesce(p_description,''),
        due_date=p_due_date, updated_at=pg_catalog.clock_timestamp()
    where id=p_milestone_id and project_id=p_project_id and status='upcoming'
    returning id into v_milestone_id;
    if not found then
      return pg_catalog.jsonb_build_object('outcome','milestone_not_editable');
    end if;
    v_outcome := 'updated';
  end if;

  insert into public.project_activity(project_id,event_type,actor_type,details)
  values(p_project_id,'milestone_'||v_outcome,'admin',
    pg_catalog.jsonb_build_object('milestone_id',v_milestone_id,'title',pg_catalog.btrim(p_title)));
  return pg_catalog.jsonb_build_object('outcome',v_outcome,'milestone_id',v_milestone_id);
end;
$$;
revoke all on function public.save_draft_project_milestone(uuid,uuid,text,text,date) from public,anon,authenticated;
grant execute on function public.save_draft_project_milestone(uuid,uuid,text,text,date) to service_role;
