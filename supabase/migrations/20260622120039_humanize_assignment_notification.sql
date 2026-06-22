-- Improve the assignment notification title from the generic "Work order
-- assigned to you" to "Alice Smith assigned you a work order" so the recipient
-- immediately knows who is responsible. Redefines notify_work_order_changes
-- from 20260619120038.
--
-- The assigner is new.updated_by on UPDATE (the person who saved the change)
-- and new.created_by on INSERT (the admin or requester who filed the order
-- with an assignee already set). The trigger is already SECURITY DEFINER
-- (owned by postgres), so it can join auth.users without an RLS check.

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
