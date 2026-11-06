create or replace function public.validate_project_commercial_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active'
    and old.status = 'invited'
  then
    if new.package_key is null
      or pg_catalog.btrim(new.package_key) = ''
      or new.agreed_price is null
      or new.currency is null
      or pg_catalog.btrim(new.currency) = ''
      or jsonb_typeof(new.package_snapshot) <> 'object'
      or new.package_snapshot = '{}'::jsonb
      or jsonb_typeof(new.agreed_scope) <> 'object'
      or new.agreed_scope = '{}'::jsonb
    then
      raise exception 'project_commercial_terms_required';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_project_commercial_activation
on public.client_projects;

create trigger validate_project_commercial_activation
before update of status on public.client_projects
for each row
when (new.status = 'active' and old.status = 'invited')
execute function public.validate_project_commercial_activation();

revoke all on function public.validate_project_commercial_activation()
from public, anon, authenticated;

grant execute on function public.validate_project_commercial_activation()
to service_role;
