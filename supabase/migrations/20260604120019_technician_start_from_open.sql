-- Technicians start work directly from Open; the Assigned status is retired
-- from the active workflow (Open -> In Progress -> Done -> Closed). Update the
-- technician RLS policy and the column-immutability trigger so the only
-- technician transitions are Open -> In Progress and In Progress -> Done.

drop policy if exists "Technicians can advance work order status" on public.work_orders;

create policy "Technicians can advance work order status"
  on public.work_orders
  for update
  to authenticated
  using (
    public.current_user_role() = 'technician'
    and status in ('open', 'in_progress')
    and assigned_to = auth.uid()
  )
  with check (
    public.current_user_role() = 'technician'
    and updated_by = auth.uid()
    and assigned_to = auth.uid()
    and status in ('in_progress', 'done')
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
    if new.category                        is distinct from old.category
       or new.property                     is distinct from old.property
       or new.unit_number                  is distinct from old.unit_number
       or new.priority                     is distinct from old.priority
       or new.due_at                       is distinct from old.due_at
       or new.title                        is distinct from old.title
       or new.description                  is distinct from old.description
       or new.resolution                   is distinct from old.resolution
       or new.reported_by_name             is distinct from old.reported_by_name
       or new.reported_by_email            is distinct from old.reported_by_email
       or new.reported_by_phone            is distinct from old.reported_by_phone
       or new.work_order_number            is distinct from old.work_order_number
       or new.marketing_request_type       is distinct from old.marketing_request_type
       or new.marketing_request_type_other is distinct from old.marketing_request_type_other
       or new.marketing_event_name         is distinct from old.marketing_event_name
       or new.marketing_target_audience    is distinct from old.marketing_target_audience
       or new.marketing_target_audience_other is distinct from old.marketing_target_audience_other
       or new.marketing_key_message        is distinct from old.marketing_key_message
       or new.marketing_size_format        is distinct from old.marketing_size_format
       or new.marketing_size_format_other  is distinct from old.marketing_size_format_other
       or new.created_by                   is distinct from old.created_by
       or new.created_at                   is distinct from old.created_at
    then
      raise exception 'Your role may only change the status of a work order'
        using errcode = '42501';
    end if;

    if new.status is distinct from old.status then
      if v_role = 'technician' then
        if not (
             (old.status = 'open'        and new.status = 'in_progress')
          or (old.status = 'in_progress' and new.status = 'done')
        ) then
          raise exception 'Technicians may only advance status open -> in_progress or in_progress -> done'
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
