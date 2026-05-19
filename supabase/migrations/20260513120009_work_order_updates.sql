-- Work order updates: who can edit, and which columns each role may touch.
--
-- The base table (migration 20260513120008) deliberately left UPDATE/DELETE
-- policies off so RLS denied everything until this flow was designed.
--
-- Roles fall into three editing tiers:
--   editors    (administrator, requester) - may change any column
--   technicians                           - may only advance status
--                                            assigned -> in_progress
--                                            in_progress -> done
--   inspectors                            - may only close tickets
--                                            done -> closed
--
-- RLS gates which rows each role may touch and the shape of the new row.
-- A BEFORE UPDATE trigger then enforces column-level immutability and the
-- exact status transitions for the restricted roles, so even a hand-crafted
-- request that passes the policy cannot smuggle other column changes through.

create policy "Editors can update work orders"
  on public.work_orders
  for update
  to authenticated
  using (
    public.current_user_role() in ('administrator', 'requester')
  )
  with check (
    public.current_user_role() in ('administrator', 'requester')
    and updated_by = auth.uid()
  );

create policy "Technicians can advance work order status"
  on public.work_orders
  for update
  to authenticated
  using (
    public.current_user_role() = 'technician'
    and status in ('assigned', 'in_progress')
    and assigned_to = auth.uid()
  )
  with check (
    public.current_user_role() = 'technician'
    and updated_by = auth.uid()
    and assigned_to = auth.uid()
    and status in ('in_progress', 'done')
  );

create policy "Inspectors can close completed work orders"
  on public.work_orders
  for update
  to authenticated
  using (
    public.current_user_role() = 'inspector'
    and status = 'done'
    and assigned_to = auth.uid()
  )
  with check (
    public.current_user_role() = 'inspector'
    and updated_by = auth.uid()
    and assigned_to = auth.uid()
    and status = 'closed'
  );

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

revoke execute on function public.enforce_work_order_update_columns() from public;

-- Runs alphabetically before work_orders_set_updated_at, which lets the
-- updated_at trigger keep stamping the row after this one has validated.
create trigger work_orders_enforce_update_columns
  before update on public.work_orders
  for each row execute function public.enforce_work_order_update_columns();
