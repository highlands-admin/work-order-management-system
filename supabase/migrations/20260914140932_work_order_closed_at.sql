-- When a work order was closed, as its own column, so the dashboard can chart
-- closures over time beside the work created over the same days.
--
-- The activity log already records every status transition, so the history is
-- recoverable from it, but a column on work_orders is what lets the dashboard's
-- single filtered query answer "created and closed per bucket" without a join:
-- every facet already applied to the row set (facility, assignee, category, and
-- the rest) then applies to the closure count for free.
--
-- The column records the LAST time the work order entered the closed state. A
-- work order closed, reopened, and closed again reports only the second date.
-- Reopening does not clear it, because a closure is an event that happened and
-- the chart counts events; the column is "when this was last closed," not "is
-- this closed," which the status column already answers.

alter table public.work_orders
  add column if not exists closed_at timestamptz;

comment on column public.work_orders.closed_at is
  'When the work order last entered the closed status. Set by trigger; never cleared on reopen.';

-- The dashboard reads closed_at over a date range, so index the rows that have
-- one. Most work orders are not closed, which is what makes the partial index
-- much smaller than the column.
create index if not exists work_orders_closed_at_idx
  on public.work_orders (closed_at)
  where closed_at is not null;

-- Keep closed_at out of the activity feed. It is derived from the status change
-- that is already logged on the same update, so logging it too would show every
-- closure twice, once in the reader's language and once in the column's.
-- Redefines log_work_order_changes from 20260714140000_activity_ignore_search_text.
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
    'work_order_code', 'search_text', 'closed_at'
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

-- Stamps the column on the transition into closed. A trigger rather than the
-- application, so every path that closes a work order is covered: the detail
-- page control, the inspector's transition form, the board's drag to Closed,
-- and any direct SQL.
--
-- closed_at is not in the column-immutability trigger's locked list, so a
-- technician or inspector closing a work order does not trip it, and the write
-- happens no matter which role performed the transition.
create or replace function public.work_orders_set_closed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'closed' and old.status is distinct from 'closed' then
    new.closed_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.work_orders_set_closed_at() from public;

drop trigger if exists work_orders_set_closed_at on public.work_orders;
create trigger work_orders_set_closed_at
  before update on public.work_orders
  for each row execute function public.work_orders_set_closed_at();

-- Backfill. The activity log is the accurate source, holding the timestamp of
-- every status change since 20260605120023. Work orders closed before that (or
-- closed by the backfill in 20260605120024, which could only synthesize
-- 'created' entries) fall back to updated_at, which is the closest thing the row
-- still remembers.
--
-- Three triggers are disabled around the backfill. This is a migration filling
-- in a derived column, not a user editing the work order, so it must not bump
-- "Last modified" or write an entry into anyone's activity feed.
--
-- The column-immutability trigger has to come off too. It reads
-- current_user_role(), which is null for a migration (no JWT, so no user_role
-- claim), and its live definition has no null branch: both of its `v_role in
-- (...)` tests evaluate to null rather than true, so control reaches the final
-- raise and the backfill dies with "Your role is not permitted to update work
-- orders". Disabling it here follows the precedent set by the backfill in
-- 20260604120015_work_order_id_and_title.sql.
alter table public.work_orders disable trigger work_orders_set_updated_at;
alter table public.work_orders disable trigger work_orders_log_activity;
alter table public.work_orders disable trigger work_orders_enforce_update_columns;

update public.work_orders w
set closed_at = latest.closed_at
from (
  select
    work_order_id,
    max(created_at) as closed_at
  from public.work_order_activity
  where action = 'updated'
    and details -> 'changes' -> 'status' ->> 'to' = 'closed'
  group by work_order_id
) as latest
where w.id = latest.work_order_id
  and w.closed_at is null;

update public.work_orders
set closed_at = updated_at
where status = 'closed'
  and closed_at is null;

alter table public.work_orders enable trigger work_orders_set_updated_at;
alter table public.work_orders enable trigger work_orders_log_activity;
alter table public.work_orders enable trigger work_orders_enforce_update_columns;
