-- Notify a work order's creator and assignee when a note on it is added, edited,
-- or deleted. The person who made the note change is never notified about their
-- own action. Reuses the notifications table from 20260619120036.

create or replace function public.notify_work_order_note_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work_order_id uuid;
  v_actor         uuid;
  v_type          text;
  v_title         text;
  v_wo            record;
  v_recipient     uuid;
begin
  if tg_op = 'INSERT' then
    v_work_order_id := new.work_order_id;
    v_actor := new.created_by;
    v_type := 'note_added';
    v_title := 'New Note Added';
  elsif tg_op = 'UPDATE' then
    -- Only the body is editable; ignore no-op updates.
    if new.body is not distinct from old.body then
      return new;
    end if;
    v_work_order_id := new.work_order_id;
    v_actor := auth.uid();
    v_type := 'note_edited';
    v_title := 'A note was edited';
  else
    v_work_order_id := old.work_order_id;
    v_actor := auth.uid();
    v_type := 'note_deleted';
    v_title := 'A note was deleted';
  end if;

  select created_by, assigned_to, work_order_code, title
    into v_wo
  from public.work_orders
  where id = v_work_order_id;

  if not found then
    return coalesce(new, old);
  end if;

  -- The creator and the assignee, minus whoever made the change, deduped.
  for v_recipient in
    select distinct r
    from unnest(array[v_wo.created_by, v_wo.assigned_to]) as r
    where r is not null and r is distinct from v_actor
  loop
    insert into public.notifications (user_id, type, title, body, work_order_id)
    values (
      v_recipient,
      v_type,
      v_title,
      coalesce(v_wo.work_order_code, '') || ' · ' || coalesce(v_wo.title, ''),
      v_work_order_id
    );
  end loop;

  return coalesce(new, old);
end;
$$;

create trigger work_order_notes_notify
  after insert or update or delete on public.work_order_notes
  for each row execute function public.notify_work_order_note_changes();
