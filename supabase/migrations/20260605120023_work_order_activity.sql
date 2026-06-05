-- Per-work-order audit trail. Database triggers record every change so the log
-- is complete regardless of which code path made it (Server Action, direct SQL,
-- etc.). The table is append-only and read-only to clients: only the
-- SECURITY DEFINER trigger functions write to it (they run as the table owner
-- and bypass RLS), and there are no insert/update/delete policies.

create table public.work_order_activity (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  -- Who made the change. Null for system/migration changes or deleted users.
  actor_id      uuid references auth.users(id) on delete set null,
  action        text not null,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index work_order_activity_work_order_id_idx
  on public.work_order_activity (work_order_id, created_at desc);

alter table public.work_order_activity enable row level security;

-- Read: any authenticated user can read activity (same visibility as work orders).
create policy "Authenticated users can read work order activity"
  on public.work_order_activity
  for select
  to authenticated
  using (true);

grant select on public.work_order_activity to authenticated;

-- Logs work order creation and field-level edits. On update it diffs every
-- column (except audit/generated columns) and records each change as
-- details.changes = { column: { from, to } }.
create or replace function public.log_work_order_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old     jsonb;
  v_new     jsonb;
  v_key     text;
  v_changes jsonb := '{}'::jsonb;
  v_ignored text[] := array[
    'id', 'created_at', 'created_by', 'updated_at', 'updated_by', 'work_order_code'
  ];
begin
  if tg_op = 'INSERT' then
    insert into public.work_order_activity (work_order_id, actor_id, action, details)
    values (new.id, new.created_by, 'created', '{}'::jsonb);
    return new;
  end if;

  v_old := to_jsonb(old);
  v_new := to_jsonb(new);

  for v_key in select jsonb_object_keys(v_new) loop
    if v_key = any(v_ignored) then
      continue;
    end if;
    if v_old -> v_key is distinct from v_new -> v_key then
      v_changes := v_changes || jsonb_build_object(
        v_key,
        jsonb_build_object('from', v_old -> v_key, 'to', v_new -> v_key)
      );
    end if;
  end loop;

  -- Skip no-op updates (only audit columns changed).
  if v_changes <> '{}'::jsonb then
    insert into public.work_order_activity (work_order_id, actor_id, action, details)
    values (
      new.id,
      coalesce(new.updated_by, auth.uid()),
      'updated',
      jsonb_build_object('changes', v_changes)
    );
  end if;

  return new;
end;
$$;

create trigger work_orders_log_activity
  after insert or update on public.work_orders
  for each row execute function public.log_work_order_changes();

-- Logs note add / edit / delete, capturing the body (and the before/after on
-- edit) so the trail shows what changed.
create or replace function public.log_work_order_note_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.work_order_activity (work_order_id, actor_id, action, details)
    values (
      new.work_order_id, new.created_by, 'note_added',
      jsonb_build_object('note_id', new.id, 'body', new.body)
    );
    return new;
  elsif tg_op = 'UPDATE' then
    if new.body is distinct from old.body then
      insert into public.work_order_activity (work_order_id, actor_id, action, details)
      values (
        new.work_order_id, auth.uid(), 'note_edited',
        jsonb_build_object('note_id', new.id, 'from', old.body, 'to', new.body)
      );
    end if;
    return new;
  else
    insert into public.work_order_activity (work_order_id, actor_id, action, details)
    values (
      old.work_order_id, auth.uid(), 'note_deleted',
      jsonb_build_object('note_id', old.id, 'body', old.body)
    );
    return old;
  end if;
end;
$$;

create trigger work_order_notes_log_activity
  after insert or update or delete on public.work_order_notes
  for each row execute function public.log_work_order_note_changes();
