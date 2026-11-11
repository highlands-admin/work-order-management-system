-- Reminders for items that are already overdue.
--
-- The reminder query only looked at occurrences up to one day past due, so a
-- compliance item imported or created after its due date (or whose recipients
-- were added late) never sent a single email. An occurrence that has had no
-- alert at all is now included however overdue it is; once one alert is sent
-- it falls back to the old one-day window, so overdue items are not re-sent
-- every day. The cron route sends one email per work order and records every
-- due lead time.
--
-- Same signature as 20261001120000_org_properties.sql, so create or replace.
-- Rollback: re-run that file's definition of this function.

create or replace function public.recurring_work_orders_due_for_reminder()
returns table (
  id              uuid,
  work_order_code text,
  title           text,
  category        public.work_order_category,
  priority        public.work_order_priority,
  status          public.work_order_status,
  property        text,
  property_name   text,
  unit_number     text,
  due_at          timestamptz,
  description     text,
  provider        text,
  lead_days       integer,
  recipients      jsonb
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
    p.name,
    w.unit_number,
    w.due_at,
    w.description,
    w.provider,
    lead.lead_days,
    (
      select coalesce(
        jsonb_agg(jsonb_build_object(
          'email', u.email,
          'first_name', nullif(trim(coalesce(u.raw_user_meta_data ->> 'first_name', '')), '')
        )),
        '[]'::jsonb
      )
      from auth.users u
      where u.id = any (t.reminder_recipients)
        and u.email is not null
    ) as recipients
  from public.work_orders w
  join public.recurring_work_orders t on t.id = w.recurring_work_order_id
  left join public.properties p
    on p.organization_id = w.organization_id
   and p.key = w.property
  cross join lateral unnest(t.reminder_lead_days) as lead(lead_days)
  where w.recurring_work_order_id is not null
    and w.status in ('open', 'in_progress', 'on_hold')
    and w.due_at is not null
    and coalesce(array_length(t.reminder_recipients, 1), 0) >= 1
    and lead.lead_days <> all (w.reminder_sent_lead_days)
    and now() >= w.due_at - make_interval(days => lead.lead_days)
    and (
      now() < w.due_at + interval '1 day'
      or coalesce(array_length(w.reminder_sent_lead_days, 1), 0) = 0
    )
$$;

revoke all on function public.recurring_work_orders_due_for_reminder() from public, anon, authenticated;
grant execute on function public.recurring_work_orders_due_for_reminder() to service_role;
