-- Functions that drive the recurrence feature:
--   generate_due_recurring_work_orders(): materialize due occurrences.
--   recurring_work_orders_due_for_reminder(): list occurrences needing a
--     reminder email, including the resolved recipient.
--
-- Both are SECURITY DEFINER and owned by postgres (which has BYPASSRLS), so they
-- run with full access regardless of the caller, the same pattern the activity
-- log triggers use. The generation function is invoked by pg_cron; the reminder
-- list is read by the cron-triggered API route through the service role.

-- Materialize every occurrence that is due within its template's generation
-- window, then advance the template to the next occurrence. Returns the number
-- of work orders created. Safe to run repeatedly: an occurrence already created
-- for the current cycle is skipped, and the schedule still advances so a
-- template can never get stuck on a past date.
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
    -- Create the occurrence unless one already exists for this exact due date.
    if not exists (
      select 1
      from public.work_orders w
      where w.recurring_work_order_id = r.id
        and w.due_at = r.next_due_at
    ) then
      insert into public.work_orders (
        title, category, priority, property, unit_number, description,
        provider, assigned_to, due_at, status,
        recurring_work_order_id, created_by, updated_by
      ) values (
        r.title, r.category, r.priority, r.property, r.unit_number, r.description,
        r.provider, r.assigned_to, r.next_due_at, 'open',
        r.id, r.created_by, r.created_by
      );
      v_created := v_created + 1;
    end if;

    -- Advance the schedule. one_time templates fire once and deactivate.
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

-- List generated occurrences whose due date is inside their template's reminder
-- window and that have not been reminded yet. The recipient is the assignee when
-- set, otherwise the creator; the email and first name are resolved here so the
-- caller never needs direct access to auth.users.
create or replace function public.recurring_work_orders_due_for_reminder()
returns table (
  id                uuid,
  work_order_code   text,
  title             text,
  category          public.work_order_category,
  priority          public.work_order_priority,
  status            public.work_order_status,
  property          public.property,
  unit_number       text,
  due_at            timestamptz,
  description       text,
  provider          text,
  recipient_email   text,
  recipient_name    text
)
language sql
security definer
set search_path = ''
as $$
  select
    w.id,
    w.work_order_code,
    w.title,
    w.category,
    w.priority,
    w.status,
    w.property,
    w.unit_number,
    w.due_at,
    w.description,
    w.provider,
    u.email,
    nullif(trim(coalesce(u.raw_user_meta_data ->> 'first_name', '')), '')
  from public.work_orders w
  join public.recurring_work_orders t on t.id = w.recurring_work_order_id
  join auth.users u on u.id = coalesce(w.assigned_to, w.created_by)
  where w.recurring_work_order_id is not null
    and w.reminder_sent_at is null
    and w.status in ('open', 'in_progress')
    and w.due_at is not null
    and w.due_at <= now() + make_interval(days => t.reminder_lead_days)
$$;

revoke execute on function public.recurring_work_orders_due_for_reminder() from public;
