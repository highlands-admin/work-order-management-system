-- Extend work order notifications to cover general status changes (Open, In
-- Progress, Done, Closed), notifying the creator and assignee except whoever
-- made the change. The dedicated approved/rejected notifications are kept and
-- take precedence, so a single change never produces two notifications for the
-- same person. Redefines notify_work_order_changes from 20260619120036.
create or replace function public.notify_work_order_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_summary      text := coalesce(new.work_order_code, '') || ' · ' || coalesce(new.title, '');
  v_status_label text;
  v_recipient    uuid;
begin
  if tg_op = 'INSERT' then
    if new.assigned_to is not null and new.assigned_to <> new.created_by then
      insert into public.notifications (user_id, type, title, body, work_order_id)
      values (new.assigned_to, 'assigned', 'Work order assigned to you', v_summary, new.id);
    end if;
    return new;
  end if;

  -- Reassigned to a new person (and not by that person themselves).
  if new.assigned_to is not null
     and new.assigned_to is distinct from old.assigned_to
     and new.assigned_to <> new.updated_by then
    insert into public.notifications (user_id, type, title, body, work_order_id)
    values (new.assigned_to, 'assigned', 'Work order assigned to you', v_summary, new.id);
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
      when 'open' then 'Open'
      when 'in_progress' then 'In Progress'
      when 'done' then 'Done'
      when 'closed' then 'Closed'
      when 'pending' then 'Pending'
      when 'rejected' then 'Rejected'
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
