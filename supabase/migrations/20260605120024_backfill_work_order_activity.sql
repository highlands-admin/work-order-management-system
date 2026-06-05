-- Seed the activity log with each existing work order's initial history so work
-- orders created before the audit trail still show their creation (and last
-- update, when it differs) timestamped at the work order's own dates. New work
-- orders get these events from the triggers instead.

insert into public.work_order_activity (work_order_id, actor_id, action, details, created_at)
select w.id, w.created_by, 'created', '{}'::jsonb, w.created_at
from public.work_orders w
where not exists (
  select 1 from public.work_order_activity a where a.work_order_id = w.id
);

-- A "last updated" baseline (no field-level detail, since the historical diff
-- is unknown) for rows that were edited at some point and have no logged update.
insert into public.work_order_activity (work_order_id, actor_id, action, details, created_at)
select w.id, w.updated_by, 'updated', '{}'::jsonb, w.updated_at
from public.work_orders w
where w.updated_at > w.created_at
  and not exists (
    select 1 from public.work_order_activity a
    where a.work_order_id = w.id and a.action <> 'created'
  );
