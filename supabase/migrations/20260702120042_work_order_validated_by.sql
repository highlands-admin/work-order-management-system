-- Closing a work order records who validated the completed work. The column is
-- nullable (older work orders and open ones have no validator); the app
-- requires it, alongside a resolution, when moving a work order to closed.

alter table public.work_orders
  add column validated_by uuid references auth.users(id) on delete restrict;

comment on column public.work_orders.validated_by is
  'The user who validated the work when the order was closed. The app requires it to move a work order to closed.';

-- Redefine the column-immutability trigger so an inspector may write
-- validated_by only while closing a done work order (mirroring the technician
-- resolution-on-done exception). For every other role/transition the column is
-- locked for technicians and inspectors. Administrators and requesters are
-- unaffected (they return early). This keeps every other rule from
-- 20260618120034 intact.
create or replace function public.enforce_work_order_update_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role       public.app_role := public.current_user_role();
  v_completing boolean;
  v_validating boolean;
begin
  if v_role is null then
    return new;
  end if;

  if v_role in ('administrator', 'requester') then
    return new;
  end if;

  if v_role in ('technician', 'inspector') then
    v_completing := (
      v_role = 'technician'
      and old.status = 'in_progress'
      and new.status = 'done'
    );
    -- An inspector recording who validated the work while closing it.
    v_validating := (
      v_role = 'inspector'
      and old.status = 'done'
      and new.status = 'closed'
    );

    if new.category                        is distinct from old.category
       or new.property                     is distinct from old.property
       or new.unit_number                  is distinct from old.unit_number
       or new.priority                     is distinct from old.priority
       or new.due_at                       is distinct from old.due_at
       or new.title                        is distinct from old.title
       or new.description                  is distinct from old.description
       or (new.resolution is distinct from old.resolution and not v_completing)
       or (new.validated_by is distinct from old.validated_by and not v_validating)
       or new.reported_by_name             is distinct from old.reported_by_name
       or new.reported_by_email            is distinct from old.reported_by_email
       or new.reported_by_phone            is distinct from old.reported_by_phone
       or new.work_order_number            is distinct from old.work_order_number
       or new.recurring_work_order_id      is distinct from old.recurring_work_order_id
       or new.provider                     is distinct from old.provider
       or new.reminder_sent_at             is distinct from old.reminder_sent_at
       or new.reminder_sent_lead_days      is distinct from old.reminder_sent_lead_days
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
