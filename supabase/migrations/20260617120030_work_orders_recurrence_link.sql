-- Link generated work orders back to their recurring template, and add the
-- columns the recurrence feature needs on the work order itself.

alter table public.work_orders
  add column if not exists recurring_work_order_id uuid
    references public.recurring_work_orders(id) on delete set null,
  -- The vendor or department performing the work. Stamped from the template on
  -- generated occurrences, and available to one-off inspections too.
  add column if not exists provider text,
  -- When the reminder email for this occurrence was sent, so the reminder job
  -- never emails the same occurrence twice.
  add column if not exists reminder_sent_at timestamptz;

-- The reminder job scans for generated occurrences that still need a reminder,
-- so index that working set.
create index if not exists work_orders_recurrence_reminder_idx
  on public.work_orders (due_at)
  where recurring_work_order_id is not null and reminder_sent_at is null;

-- Extend the column-immutability trigger so technicians and inspectors, who may
-- only advance status, cannot edit the new recurrence columns. The function also
-- now lets a null application role through: the recurrence generation function
-- and the reminder job write as a trusted backend role (postgres / service_role)
-- with no user_role claim, and those paths are gated separately (SECURITY
-- DEFINER ownership and a bearer secret), not by this per-column guard.
create or replace function public.enforce_work_order_update_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role := public.current_user_role();
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
