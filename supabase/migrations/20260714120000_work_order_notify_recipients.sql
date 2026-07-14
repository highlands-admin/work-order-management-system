-- Optional extra notification recipients per work order. These users receive
-- in-app notifications for the same events the creator and assignee do, so they
-- can watch a work order without being assigned to it.
--
-- Stored as a uuid[] on the work order (matching recurring_work_orders'
-- reminder_recipients), so the notification triggers can fan out to them by
-- unnesting the array alongside the creator and assignee.
--
-- Scope: recipients get status changes, approval, rejection, and note activity.
-- They do NOT get the personal "assigned to you" ping, which stays specific to
-- the assignee.
--
-- Statements are idempotent so the migration re-runs cleanly.

alter table public.work_orders
  add column if not exists notify_recipients uuid[] not null default '{}'::uuid[];

-- Status / assignment notifications. Redefines the function from
-- 20260707171937_on_hold_status_support.sql to also notify notify_recipients on
-- approval, rejection, and other status changes.
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
  if tg_op = 'INSERT' then
    v_assigner_id := new.created_by;
  else
    v_assigner_id := new.updated_by;
  end if;

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

  -- Reassigned to a new person (and not by that person themselves). This ping is
  -- personal to the assignee, so notify_recipients are intentionally excluded.
  if new.assigned_to is not null
     and new.assigned_to is distinct from old.assigned_to
     and new.assigned_to <> new.updated_by then
    insert into public.notifications (user_id, type, title, body, work_order_id)
    values (new.assigned_to, 'assigned', v_assign_title, v_summary, new.id);
  end if;

  -- Status changes. Approved and rejected are submission outcomes for the
  -- creator; every other change is general activity for the creator and
  -- assignee. In all three, notify_recipients watch alongside them, and the
  -- person making the change is never notified about it.
  if old.status in ('pending', 'rejected') and new.status = 'open' then
    for v_recipient in
      select distinct r
      from unnest(new.created_by || new.notify_recipients) as r
      where r is not null and r is distinct from new.updated_by
    loop
      insert into public.notifications (user_id, type, title, body, work_order_id)
      values (v_recipient, 'approved', 'Work order approved', v_summary, new.id);
    end loop;
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    for v_recipient in
      select distinct r
      from unnest(new.created_by || new.notify_recipients) as r
      where r is not null and r is distinct from new.updated_by
    loop
      insert into public.notifications (user_id, type, title, body, work_order_id)
      values (v_recipient, 'rejected', 'Work order rejected', v_summary, new.id);
    end loop;
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
      from unnest(array[new.created_by, new.assigned_to] || new.notify_recipients) as r
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

-- Note notifications. Redefines the function from
-- 20260702120041_note_notification_details.sql to also notify the work order's
-- notify_recipients, alongside its creator and assignee.
create or replace function public.notify_work_order_note_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work_order_id uuid;
  v_actor         uuid;
  v_actor_name    text;
  v_action        text;
  v_type          text;
  v_title         text;
  v_note_body     text;
  v_preview       text;
  v_wo            record;
  v_recipient     uuid;
begin
  if tg_op = 'INSERT' then
    v_work_order_id := new.work_order_id;
    v_actor := new.created_by;
    v_type := 'note_added';
    v_action := ' added a note to ';
    v_note_body := new.body;
  elsif tg_op = 'UPDATE' then
    if new.body is not distinct from old.body then
      return new;
    end if;
    v_work_order_id := new.work_order_id;
    v_actor := auth.uid();
    v_type := 'note_edited';
    v_action := ' edited a note on ';
    v_note_body := new.body;
  else
    v_work_order_id := old.work_order_id;
    v_actor := auth.uid();
    v_type := 'note_deleted';
    v_action := ' deleted a note on ';
    v_note_body := old.body;
  end if;

  select created_by, assigned_to, work_order_code, title, notify_recipients
    into v_wo
  from public.work_orders
  where id = v_work_order_id;

  if not found then
    return coalesce(new, old);
  end if;

  select nullif(
           trim(concat_ws(' ',
             u.raw_user_meta_data ->> 'first_name',
             u.raw_user_meta_data ->> 'last_name')),
           '')
    into v_actor_name
  from auth.users u
  where u.id = v_actor;

  if v_actor_name is null then
    select u.email into v_actor_name from auth.users u where u.id = v_actor;
  end if;

  v_title := coalesce(v_actor_name, 'Someone')
             || v_action
             || coalesce(v_wo.work_order_code, 'a work order')
             || case
                  when coalesce(v_wo.title, '') <> '' then ' · ' || v_wo.title
                  else ''
                end;

  v_preview := trim(regexp_replace(coalesce(v_note_body, ''), '\s+', ' ', 'g'));
  if length(v_preview) > 160 then
    v_preview := left(v_preview, 160) || '…';
  end if;

  -- The creator, the assignee, and the extra notify_recipients, minus whoever
  -- made the change, deduped.
  for v_recipient in
    select distinct r
    from unnest(array[v_wo.created_by, v_wo.assigned_to] || v_wo.notify_recipients) as r
    where r is not null and r is distinct from v_actor
  loop
    insert into public.notifications (user_id, type, title, body, work_order_id)
    values (
      v_recipient,
      v_type,
      v_title,
      nullif(v_preview, ''),
      v_work_order_id
    );
  end loop;

  return coalesce(new, old);
end;
$$;

-- Column-level immutability: notify_recipients is an editor-controlled field, so
-- restricted roles (technician, inspector) may not change it. Redefines the
-- function from 20260513120009_work_order_updates.sql to add it to the guarded
-- set.
create or replace function public.enforce_work_order_update_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role := public.current_user_role();
begin
  if v_role in ('administrator', 'requester') then
    return new;
  end if;

  if v_role in ('technician', 'inspector') then
    if new.category             is distinct from old.category
       or new.property          is distinct from old.property
       or new.unit_number       is distinct from old.unit_number
       or new.priority          is distinct from old.priority
       or new.due_at            is distinct from old.due_at
       or new.description       is distinct from old.description
       or new.resolution        is distinct from old.resolution
       or new.reported_by_name  is distinct from old.reported_by_name
       or new.reported_by_email is distinct from old.reported_by_email
       or new.reported_by_phone is distinct from old.reported_by_phone
       or new.notify_recipients is distinct from old.notify_recipients
       or new.created_by        is distinct from old.created_by
       or new.created_at        is distinct from old.created_at
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
