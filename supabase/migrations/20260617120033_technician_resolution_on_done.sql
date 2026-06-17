-- Allow a technician to attach a resolution when completing a work order.
--
-- Marking a work order Done now requires a resolution (enforced in the app and
-- collected through a modal). Technicians are the ones who complete the work, so
-- the column-immutability trigger must let them write `resolution` on the
-- in_progress -> done transition. Every other column stays locked for them, and
-- inspectors remain unable to edit resolution. This redefines
-- enforce_work_order_update_columns from 20260617120030 with that single
-- exception.
create or replace function public.enforce_work_order_update_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role       public.app_role := public.current_user_role();
  v_completing boolean;
begin
  -- Trusted backend writes (recurrence generation, reminder stamping) run with
  -- no user_role claim. Authenticated callers always carry a role, and RLS
  -- denies role-less callers before this trigger runs, so passing here is safe.
  if v_role is null then
    return new;
  end if;

  if v_role in ('administrator', 'requester') then
    return new;
  end if;

  if v_role in ('technician', 'inspector') then
    -- A technician completing the work (in_progress -> done) may write the
    -- resolution. All other column edits stay blocked for both roles.
    v_completing := (
      v_role = 'technician'
      and old.status = 'in_progress'
      and new.status = 'done'
    );

    if new.category                        is distinct from old.category
       or new.property                     is distinct from old.property
       or new.unit_number                  is distinct from old.unit_number
       or new.priority                     is distinct from old.priority
       or new.due_at                       is distinct from old.due_at
       or new.title                        is distinct from old.title
       or new.description                  is distinct from old.description
       or (new.resolution is distinct from old.resolution and not v_completing)
       or new.reported_by_name             is distinct from old.reported_by_name
       or new.reported_by_email            is distinct from old.reported_by_email
       or new.reported_by_phone            is distinct from old.reported_by_phone
       or new.work_order_number            is distinct from old.work_order_number
       or new.recurring_work_order_id      is distinct from old.recurring_work_order_id
       or new.provider                     is distinct from old.provider
       or new.reminder_sent_at             is distinct from old.reminder_sent_at
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
