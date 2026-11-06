alter table public.project_reviews
  add column if not exists display_order integer not null default 100000,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_reviews_display_order_range'
      and conrelid = 'public.project_reviews'::regclass
  ) then
    alter table public.project_reviews
      add constraint project_reviews_display_order_range
      check (display_order between 0 and 100000);
  end if;
end $$;

with ranked_reviews as (
  select id, row_number() over (order by created_at desc, id) - 1 as position
  from public.project_reviews
)
update public.project_reviews as reviews
set display_order = ranked_reviews.position
from ranked_reviews
where reviews.id = ranked_reviews.id;

create index if not exists project_reviews_public_order_idx
  on public.project_reviews (status, display_order, created_at desc);

alter table public.project_reviews
  alter column display_order set default 100000;

grant select, insert, update, delete on public.project_reviews to service_role;
