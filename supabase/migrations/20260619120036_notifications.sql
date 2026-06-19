-- Per-user in-app notifications. Rows are created by a database trigger on
-- work_orders (the same boundary the activity log uses), so every code path is
-- covered regardless of which Server Action or job made the change. Each user
-- reads, marks read, and clears only their own notifications.

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- 'assigned', 'approved', 'rejected'.
  type          text not null,
  title         text not null,
  body          text,
  -- The work order this is about, for linking. Cleared if the order is deleted.
  work_order_id uuid references public.work_orders(id) on delete cascade,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- Newest first per user, and a partial index for the unread count/badge.
create index notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

create policy "Users can read their own notifications"
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can update their own notifications"
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own notifications"
  on public.notifications
  for delete
  to authenticated
  using (user_id = auth.uid());

-- No insert policy: only the SECURITY DEFINER trigger below writes notifications.
grant select, update, delete on public.notifications to authenticated;

-- Creates notifications for the relevant user when a work order is assigned,
-- approved, or rejected. SECURITY DEFINER (owned by postgres) so it can insert
-- rows for a user other than the caller and bypass the deny-by-default insert.
create or replace function public.notify_work_order_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_summary text := coalesce(new.work_order_code, '') || ' · ' || coalesce(new.title, '');
begin
  if tg_op = 'INSERT' then
    -- Assigned to someone other than the person filing it.
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

  -- Approved: moved out of the submission flow into the active workflow.
  if old.status in ('pending', 'rejected') and new.status = 'open' then
    insert into public.notifications (user_id, type, title, body, work_order_id)
    values (new.created_by, 'approved', 'Work order approved', v_summary, new.id);
  end if;

  -- Rejected.
  if new.status = 'rejected' and old.status is distinct from 'rejected' then
    insert into public.notifications (user_id, type, title, body, work_order_id)
    values (new.created_by, 'rejected', 'Work order rejected', v_summary, new.id);
  end if;

  return new;
end;
$$;

create trigger work_orders_notify
  after insert or update on public.work_orders
  for each row execute function public.notify_work_order_changes();
