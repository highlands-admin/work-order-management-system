-- Make note notifications descriptive. Previously the body only held the work
-- order code and title, so a recipient could not tell who wrote the note or
-- what it said without opening the work order. This redefines the function from
-- 20260619120037 so the title leads with the author, the action, and the work
-- order code and title ("Alex Doe added a note to WO-1007 · Fix east wing HVAC"),
-- and the body carries a single-line preview of the note text. The existing
-- work_order_notes_notify trigger keeps pointing here.

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
    -- Only the body is editable; ignore no-op updates.
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
    -- Show what was removed.
    v_note_body := old.body;
  end if;

  select created_by, assigned_to, work_order_code, title
    into v_wo
  from public.work_orders
  where id = v_work_order_id;

  if not found then
    return coalesce(new, old);
  end if;

  -- Resolve the author's display name the same way list_assignable_users does,
  -- falling back to email and then a generic label so the title is never blank.
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

  -- Include the work order title after the code so the notification reads at a
  -- glance instead of showing an opaque code.
  v_title := coalesce(v_actor_name, 'Someone')
             || v_action
             || coalesce(v_wo.work_order_code, 'a work order')
             || case
                  when coalesce(v_wo.title, '') <> '' then ' · ' || v_wo.title
                  else ''
                end;

  -- Single-line preview of the note text for the body. Whitespace is collapsed
  -- so newlines do not break the row, and long notes are trimmed with an
  -- ellipsis.
  v_preview := trim(regexp_replace(coalesce(v_note_body, ''), '\s+', ' ', 'g'));
  if length(v_preview) > 160 then
    v_preview := left(v_preview, 160) || '…';
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
      nullif(v_preview, ''),
      v_work_order_id
    );
  end loop;

  return coalesce(new, old);
end;
$$;
