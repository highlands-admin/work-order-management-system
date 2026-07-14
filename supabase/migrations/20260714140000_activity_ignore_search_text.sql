-- Keep search_text out of the activity log. It is a derived search cache (own
-- fields + note bodies), not a user-meaningful field, and it changes on every
-- edit and every note change, which would flood the activity feed and log a
-- spurious "updated" entry each time a note is added. Redefines
-- log_work_order_changes from 20260605120023_work_order_activity.sql, adding
-- search_text to the ignored columns.

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
    'id', 'created_at', 'created_by', 'updated_at', 'updated_by',
    'work_order_code', 'search_text'
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
