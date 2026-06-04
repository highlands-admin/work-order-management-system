-- Human-friendly work order identifier (WO-####) and a required title.
--
-- The identifier is a sequential integer surfaced through a generated text
-- column, so it is stable, sortable, and queryable while the UUID stays the
-- primary key. Existing rows are numbered in creation order and have their
-- title backfilled from the description. The update-enforcement trigger is
-- disabled for the backfill, which runs without an authenticated role.

create sequence if not exists public.work_orders_number_seq start with 1001;

alter table public.work_orders
  add column if not exists work_order_number bigint,
  add column if not exists title             text;

alter table public.work_orders
  disable trigger work_orders_enforce_update_columns;

-- Number existing rows in creation order, oldest first, starting at 1001.
with ordered as (
  select id, row_number() over (order by created_at, id) as rn
  from public.work_orders
  where work_order_number is null
)
update public.work_orders w
set work_order_number = 1000 + ordered.rn
from ordered
where w.id = ordered.id;

-- Backfill titles from the description, trimmed to the title length limit.
-- Fall back to a placeholder for the rare row whose description is blank.
update public.work_orders
set title = coalesce(nullif(left(trim(description), 120), ''), 'Untitled work order')
where title is null;

alter table public.work_orders
  enable trigger work_orders_enforce_update_columns;

-- Continue the sequence after the highest backfilled number.
select setval(
  'public.work_orders_number_seq',
  coalesce((select max(work_order_number) from public.work_orders), 1000),
  true
);

alter table public.work_orders
  alter column work_order_number set default nextval('public.work_orders_number_seq'),
  alter column work_order_number set not null,
  alter column title set not null;

alter sequence public.work_orders_number_seq
  owned by public.work_orders.work_order_number;

alter table public.work_orders
  add column if not exists work_order_code text
    generated always as ('WO-' || work_order_number) stored;

create unique index if not exists work_orders_number_key
  on public.work_orders (work_order_number);

alter table public.work_orders
  drop constraint if exists work_orders_title_not_empty;
alter table public.work_orders
  add constraint work_orders_title_not_empty check (length(trim(title)) > 0);

-- Extend the column-immutability trigger so technicians and inspectors, who may
-- only advance status, cannot smuggle changes to the title, the identifier, or
-- the marketing fields. work_order_code is a generated column and so cannot be
-- written, so it does not need a guard here.
create or replace function public.enforce_work_order_update_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role := public.current_user_role();
begin
  if v_role in ('administrator', 'requester') then
    return new;
  end if;

  if v_role in ('technician', 'inspector') then
    if new.category                        is distinct from old.category
       or new.property                     is distinct from old.property
       or new.unit_number                  is distinct from old.unit_number
       or new.priority                     is distinct from old.priority
       or new.due_at                       is distinct from old.due_at
       or new.title                        is distinct from old.title
       or new.description                  is distinct from old.description
       or new.resolution                   is distinct from old.resolution
       or new.reported_by_name             is distinct from old.reported_by_name
       or new.reported_by_email            is distinct from old.reported_by_email
       or new.reported_by_phone            is distinct from old.reported_by_phone
       or new.work_order_number            is distinct from old.work_order_number
       or new.marketing_request_type       is distinct from old.marketing_request_type
       or new.marketing_request_type_other is distinct from old.marketing_request_type_other
       or new.marketing_event_name         is distinct from old.marketing_event_name
       or new.marketing_target_audience    is distinct from old.marketing_target_audience
       or new.marketing_target_audience_other is distinct from old.marketing_target_audience_other
       or new.marketing_key_message        is distinct from old.marketing_key_message
       or new.marketing_size_format        is distinct from old.marketing_size_format
       or new.marketing_size_format_other  is distinct from old.marketing_size_format_other
       or new.created_by                   is distinct from old.created_by
       or new.created_at                   is distinct from old.created_at
    then
      raise exception 'Your role may only change the status of a work order'
        using errcode = '42501';
    end if;

    if new.status is distinct from old.status then
      if v_role = 'technician' then
        if not (
             (old.status = 'assigned'    and new.status = 'in_progress')
          or (old.status = 'in_progress' and new.status = 'done')
        ) then
          raise exception 'Technicians may only advance status assigned -> in_progress or in_progress -> done'
            using errcode = '42501';
        end if;
      elsif v_role = 'inspector' then
        if not (old.status = 'done' and new.status = 'closed') then
          raise exception 'Inspectors may only close work orders that are done'
            using errcode = '42501';
        end if;
      end if;
    end if;

    return new;
  end if;

  raise exception 'Your role is not permitted to update work orders'
    using errcode = '42501';
end;
$$;
