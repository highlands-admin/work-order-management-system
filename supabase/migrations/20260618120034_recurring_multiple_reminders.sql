-- Recurring schedules: multiple reminder lead times and multiple recipients.
--
-- Previously a schedule had a single reminder_lead_days and reminders went to the
-- occurrence's assignee or creator. Now a schedule carries a list of alert lead
-- times (like calendar alerts: 1 day, 1 week, 1 month before, ...) and an
-- explicit list of recipient users. Each generated occurrence records which alert
-- lead times have already fired so none repeats.

-- recurring_work_orders: lead times become an array; add recipients.
alter table public.recurring_work_orders
  drop constraint if exists recurring_work_orders_reminder_lead_nonneg,
  drop constraint if exists recurring_work_orders_generation_covers_reminder;

alter table public.recurring_work_orders
  alter column reminder_lead_days drop default,
  alter column reminder_lead_days type integer[] using array[reminder_lead_days],
  alter column reminder_lead_days set default '{14}';

alter table public.recurring_work_orders
  add column if not exists reminder_recipients uuid[] not null default '{}';

-- Occurrences must be generated far enough ahead that the earliest alert can fire
-- on time; the application sets generation_lead_days to cover the largest alert.
alter table public.recurring_work_orders
  add constraint recurring_work_orders_generation_covers_reminder
    check (generation_lead_days >= all (reminder_lead_days));

-- work_orders: track which alert lead times have already fired per occurrence.
alter table public.work_orders
  add column if not exists reminder_sent_lead_days integer[] not null default '{}';

-- Lists the (occurrence, alert) pairs that are due to send now and have not yet
-- been sent, with the resolved recipient list. One row per occurrence per alert
-- lead time that has come due. Only schedules with at least one recipient and
-- occurrences that are not yet past due (with a one-day grace) qualify.
-- The return shape changed from the single-reminder version, so drop first.
drop function if exists public.recurring_work_orders_due_for_reminder();

create or replace function public.recurring_work_orders_due_for_reminder()
returns table (
  id              uuid,
  work_order_code text,
  title           text,
  category        public.work_order_category,
  priority        public.work_order_priority,
  status          public.work_order_status,
  property        public.property,
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
  cross join lateral unnest(t.reminder_lead_days) as lead(lead_days)
  where w.recurring_work_order_id is not null
    and w.status in ('open', 'in_progress')
    and w.due_at is not null
    and coalesce(array_length(t.reminder_recipients, 1), 0) >= 1
    and lead.lead_days <> all (w.reminder_sent_lead_days)
    and now() >= w.due_at - make_interval(days => lead.lead_days)
    and now() < w.due_at + interval '1 day'
$$;

revoke execute on function public.recurring_work_orders_due_for_reminder() from public;
grant execute on function public.recurring_work_orders_due_for_reminder() to service_role;

-- Marks one alert lead time as sent for an occurrence, deduping the array.
create or replace function public.record_reminder_sent(
  p_work_order_id uuid,
  p_lead_days integer
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.work_orders
  set reminder_sent_lead_days = (
        select array(
          select distinct unnest(reminder_sent_lead_days || array[p_lead_days])
        )
      ),
      reminder_sent_at = now()
  where id = p_work_order_id;
$$;

revoke execute on function public.record_reminder_sent(uuid, integer) from public;
grant execute on function public.record_reminder_sent(uuid, integer) to service_role;

-- Extend the column-immutability trigger to also lock the new
-- reminder_sent_lead_days column for technicians and inspectors. Keeps the
-- technician resolution-on-done exception from 20260617120033.
create or replace function public.enforce_work_order_update_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role       public.app_role := public.current_user_role();
  v_completing boolean;
begin
  if v_role is null then
    return new;
  end if;

  if v_role in ('administrator', 'requester') then
    return new;
  end if;

  if v_role in ('technician', 'inspector') then
    v_completing := (
      v_role = 'technician'
      and old.status = 'in_progress'
      and new.status = 'done'
    );

    if new.category                        is distinct from old.category
       or new.property                     is distinct from old.property
       or new.unit_number                  is distinct from old.unit_number
       or new.priority                     is distinct from old.priority
       or new.due_at                       is distinct from old.due_at
       or new.title                        is distinct from old.title
       or new.description                  is distinct from old.description
       or (new.resolution is distinct from old.resolution and not v_completing)
       or new.reported_by_name             is distinct from old.reported_by_name
       or new.reported_by_email            is distinct from old.reported_by_email
       or new.reported_by_phone            is distinct from old.reported_by_phone
       or new.work_order_number            is distinct from old.work_order_number
       or new.recurring_work_order_id      is distinct from old.recurring_work_order_id
       or new.provider                     is distinct from old.provider
       or new.reminder_sent_at             is distinct from old.reminder_sent_at
       or new.reminder_sent_lead_days      is distinct from old.reminder_sent_lead_days
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
