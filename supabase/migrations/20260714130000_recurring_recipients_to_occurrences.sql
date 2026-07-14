-- Recurring work orders now use the work order's Recipients (notify_recipients)
-- as the single recipient list: they get in-app notifications for every update
-- AND the reminder emails. The template stores this list in reminder_recipients
-- (which the reminder cron already emails), so each generated occurrence must
-- copy it into its own notify_recipients to receive the in-app notifications.
--
-- Redefines generate_due_recurring_work_orders from
-- 20260617120031_recurring_work_order_functions.sql, adding notify_recipients to
-- the occurrence insert.

create or replace function public.generate_due_recurring_work_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r          record;
  v_created  integer := 0;
  v_step     interval;
begin
  for r in
    select *
    from public.recurring_work_orders
    where active
      and next_due_at is not null
      and next_due_at <= now() + make_interval(days => generation_lead_days)
  loop
    if not exists (
      select 1
      from public.work_orders w
      where w.recurring_work_order_id = r.id
        and w.due_at = r.next_due_at
    ) then
      insert into public.work_orders (
        title, category, priority, property, unit_number, description,
        provider, assigned_to, due_at, status,
        recurring_work_order_id, notify_recipients, created_by, updated_by
      ) values (
        r.title, r.category, r.priority, r.property, r.unit_number, r.description,
        r.provider, r.assigned_to, r.next_due_at, 'open',
        r.id, coalesce(r.reminder_recipients, '{}'::uuid[]), r.created_by, r.created_by
      );
      v_created := v_created + 1;
    end if;

    if r.frequency = 'one_time' then
      update public.recurring_work_orders
        set next_due_at = null,
            active = false,
            updated_by = r.created_by
        where id = r.id;
    else
      v_step := (case r.frequency
        when 'weekly'     then interval '1 week'
        when 'monthly'    then interval '1 month'
        when 'quarterly'  then interval '3 months'
        when 'semiannual' then interval '6 months'
        when 'annual'     then interval '1 year'
      end) * r.recurrence_interval;

      update public.recurring_work_orders
        set next_due_at = r.next_due_at + v_step,
            updated_by = r.created_by
        where id = r.id;
    end if;
  end loop;

  return v_created;
end;
$$;

revoke execute on function public.generate_due_recurring_work_orders() from public;
