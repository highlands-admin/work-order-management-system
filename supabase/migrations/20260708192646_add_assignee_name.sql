-- Make the Assignee column sortable on the work order and recurring schedule
-- tables. assigned_to is a user id, and the database can't order by the name
-- resolved through a separate directory (auth.users isn't exposed to
-- PostgREST) -- so this denormalizes the resolved display name onto each row,
-- kept in sync by a trigger whenever assigned_to changes. Same tradeoff as
-- reported_by_name: a snapshot, not a live join, so a user renaming
-- themselves later doesn't retroactively update rows already assigned to them
-- until they're reassigned.

alter table public.work_orders
  add column if not exists assignee_name text;

alter table public.recurring_work_orders
  add column if not exists assignee_name text;

-- Same name-resolution expression as list_assignable_users, so the sort order
-- matches what the assignee dropdown and labels already show: "First Last",
-- falling back to email for a user who hasn't filled in a name yet.
create or replace function public.set_assignee_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to then
    if new.assigned_to is null then
      new.assignee_name := null;
    else
      select coalesce(
               nullif(trim(
                 coalesce(u.raw_user_meta_data ->> 'first_name', '')
                 || ' '
                 || coalesce(u.raw_user_meta_data ->> 'last_name', '')
               ), ''),
               u.email
             )
      into new.assignee_name
      from auth.users u
      where u.id = new.assigned_to;
    end if;
  end if;
  return new;
end;
$$;

create trigger work_orders_set_assignee_name
  before insert or update on public.work_orders
  for each row execute function public.set_assignee_name();

create trigger recurring_work_orders_set_assignee_name
  before insert or update on public.recurring_work_orders
  for each row execute function public.set_assignee_name();

-- Backfill existing rows. Migrations run with no JWT/role context, so the
-- approval-transition and column-lockdown triggers (which check
-- current_user_role()/auth.uid() against the row's creator or NULL) would
-- otherwise reject this update for pending/rejected rows. Disable them for
-- just this statement -- it only ever sets assignee_name, which neither
-- trigger has any actual opinion about -- along with set_updated_at, since an
-- internal backfill touching every row shouldn't bump every row's apparent
-- last-modified time.
alter table public.work_orders disable trigger work_orders_enforce_approval_transitions;
alter table public.work_orders disable trigger work_orders_enforce_update_columns;
alter table public.work_orders disable trigger work_orders_set_updated_at;

update public.work_orders w
set assignee_name = coalesce(
  nullif(trim(
    coalesce(u.raw_user_meta_data ->> 'first_name', '')
    || ' '
    || coalesce(u.raw_user_meta_data ->> 'last_name', '')
  ), ''),
  u.email
)
from auth.users u
where u.id = w.assigned_to;

alter table public.work_orders enable trigger work_orders_enforce_approval_transitions;
alter table public.work_orders enable trigger work_orders_enforce_update_columns;
alter table public.work_orders enable trigger work_orders_set_updated_at;

update public.recurring_work_orders r
set assignee_name = coalesce(
  nullif(trim(
    coalesce(u.raw_user_meta_data ->> 'first_name', '')
    || ' '
    || coalesce(u.raw_user_meta_data ->> 'last_name', '')
  ), ''),
  u.email
)
from auth.users u
where u.id = r.assigned_to;

create index work_orders_assignee_name_idx
  on public.work_orders (assignee_name);
create index recurring_work_orders_assignee_name_idx
  on public.recurring_work_orders (assignee_name);

-- assignee_name is a shadow of assigned_to; showing both change together in
-- the activity feed would be redundant noise. Redefines the function from
-- 20260605120023_work_order_activity.sql, adding assignee_name to the ignore
-- list.
create or replace function public.log_work_order_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old     jsonb;
  v_new     jsonb;
  v_key     text;
  v_changes jsonb := '{}'::jsonb;
  v_ignored text[] := array[
    'id', 'created_at', 'created_by', 'updated_at', 'updated_by',
    'work_order_code', 'assignee_name'
  ];
begin
  if tg_op = 'INSERT' then
    insert into public.work_order_activity (work_order_id, actor_id, action, details)
    values (new.id, new.created_by, 'created', '{}'::jsonb);
    return new;
  end if;

  v_old := to_jsonb(old);
  v_new := to_jsonb(new);

  for v_key in select jsonb_object_keys(v_new) loop
    if v_key = any(v_ignored) then
      continue;
    end if;
    if v_old -> v_key is distinct from v_new -> v_key then
      v_changes := v_changes || jsonb_build_object(
        v_key,
        jsonb_build_object('from', v_old -> v_key, 'to', v_new -> v_key)
      );
    end if;
  end loop;

  -- Skip no-op updates (only audit columns changed).
  if v_changes <> '{}'::jsonb then
    insert into public.work_order_activity (work_order_id, actor_id, action, details)
    values (
      new.id,
      coalesce(new.updated_by, auth.uid()),
      'updated',
      jsonb_build_object('changes', v_changes)
    );
  end if;

  return new;
end;
$$;
