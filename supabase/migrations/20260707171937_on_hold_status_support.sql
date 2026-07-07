-- Wire the new 'on_hold' status (added in 20260707171936) into the places
-- that enumerate the active workflow statuses.

-- Assignee/creator status changes: broaden the allowed status set to include
-- on_hold, alongside open/in_progress/done/closed. Redefines the policy from
-- 20260612120026_inline_work_order_status_change.sql.
drop policy "Assignees and creators can change status" on public.work_orders;

create policy "Assignees and creators can change status"
  on public.work_orders
  for update
  to authenticated
  using (
    (auth.uid() = assigned_to or auth.uid() = created_by)
    and status in ('open', 'in_progress', 'on_hold', 'done', 'closed')
  )
  with check (
    updated_by = auth.uid()
    and (auth.uid() = assigned_to or auth.uid() = created_by)
    and status in ('open', 'in_progress', 'on_hold', 'done', 'closed')
  );

-- Status-change notifications: humanize the on_hold label instead of falling
-- back to the raw enum string. Redefines the function from
-- 20260622120039_humanize_assignment_notification.sql.
create or replace function public.notify_work_order_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_summary        text := coalesce(new.work_order_code, '') || ' · ' || coalesce(new.title, '');
  v_status_label   text;
  v_recipient      uuid;
  v_assigner_id    uuid;
  v_assigner_name  text;
  v_assign_title   text;
begin
  -- Determine who is performing the assignment.
  if tg_op = 'INSERT' then
    v_assigner_id := new.created_by;
  else
    v_assigner_id := new.updated_by;
  end if;

  -- Resolve the assigner to a display name. Falls back to their email address
  -- if first_name / last_name have not been filled in yet.
  select coalesce(
           nullif(
             trim(
               coalesce(raw_user_meta_data ->> 'first_name', '')
               || ' '
               || coalesce(raw_user_meta_data ->> 'last_name', '')
             ),
             ''
           ),
           email
         )
  into v_assigner_name
  from auth.users
  where id = v_assigner_id;

  -- Build the notification title. If the lookup somehow returns nothing (the
  -- user was deleted between the write and this trigger firing), fall back to
  -- the old generic wording.
  if v_assigner_name is not null then
    v_assign_title := v_assigner_name || ' assigned you a work order';
  else
    v_assign_title := 'Work order assigned to you';
  end if;

  if tg_op = 'INSERT' then
    if new.assigned_to is not null and new.assigned_to <> new.created_by then
      insert into public.notifications (user_id, type, title, body, work_order_id)
      values (new.assigned_to, 'assigned', v_assign_title, v_summary, new.id);
    end if;
    return new;
  end if;

  -- Reassigned to a new person (and not by that person themselves).
  if new.assigned_to is not null
     and new.assigned_to is distinct from old.assigned_to
     and new.assigned_to <> new.updated_by then
    insert into public.notifications (user_id, type, title, body, work_order_id)
    values (new.assigned_to, 'assigned', v_assign_title, v_summary, new.id);
  end if;

  -- Status changes. Approved and rejected are submission outcomes for the
  -- creator; every other status change notifies the creator and assignee.
  if old.status in ('pending', 'rejected') and new.status = 'open' then
    insert into public.notifications (user_id, type, title, body, work_order_id)
    values (new.created_by, 'approved', 'Work order approved', v_summary, new.id);
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    insert into public.notifications (user_id, type, title, body, work_order_id)
    values (new.created_by, 'rejected', 'Work order rejected', v_summary, new.id);
  elsif new.status is distinct from old.status then
    v_status_label := case new.status
      when 'open'        then 'Open'
      when 'in_progress' then 'In Progress'
      when 'on_hold'     then 'On Hold'
      when 'done'        then 'Done'
      when 'closed'      then 'Closed'
      when 'pending'     then 'Pending'
      when 'rejected'    then 'Rejected'
      else new.status::text
    end;

    for v_recipient in
      select distinct r
      from unnest(array[new.created_by, new.assigned_to]) as r
      where r is not null and r is distinct from new.updated_by
    loop
      insert into public.notifications (user_id, type, title, body, work_order_id)
      values (
        v_recipient,
        'status_changed',
        'Status changed to ' || v_status_label,
        v_summary,
        new.id
      );
    end loop;
  end if;

  return new;
end;
$$;

-- Recurring reminder eligibility: an on-hold occurrence is still outstanding
-- and unresolved, so it keeps receiving due-date reminders rather than going
-- quiet while paused. Redefines the function from
-- 20260618120034_recurring_multiple_reminders.sql.
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
    and w.status in ('open', 'in_progress', 'on_hold')
    and w.due_at is not null
    and coalesce(array_length(t.reminder_recipients, 1), 0) >= 1
    and lead.lead_days <> all (w.reminder_sent_lead_days)
    and now() >= w.due_at - make_interval(days => lead.lead_days)
    and now() < w.due_at + interval '1 day'
$$;

revoke execute on function public.recurring_work_orders_due_for_reminder() from public;
grant execute on function public.recurring_work_orders_due_for_reminder() to service_role;
