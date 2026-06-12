-- Inline status changes from the work order detail page.
--
-- New model: administrators, the assignee, and the creator may move an approved
-- work order freely between the main workflow statuses (open, in_progress,
-- done, closed). This replaces the previous, narrower rules where a technician
-- assignee could only advance one step and an inspector could only close.
--
-- Editors (administrators and requesters) keep full-row edit rights through the
-- existing "Editors can update work orders" policy. This migration adds a
-- relationship-based, status-only path for everyone else and reworks the column
-- guard trigger to match.

drop policy "Technicians can advance work order status" on public.work_orders;
drop policy "Inspectors can close completed work orders" on public.work_orders;

-- Assignee or creator may update a row, but only while it is already in the
-- active workflow and only to another active status. The column trigger below
-- additionally restricts the change to the status column. Administrators and
-- requester creators/assignees are already covered by the editors policy; this
-- adds coverage for assignees of any other role.
create policy "Assignees and creators can change status"
  on public.work_orders
  for update
  to authenticated
  using (
    (auth.uid() = assigned_to or auth.uid() = created_by)
    and status in ('open', 'in_progress', 'done', 'closed')
  )
  with check (
    updated_by = auth.uid()
    and (auth.uid() = assigned_to or auth.uid() = created_by)
    and status in ('open', 'in_progress', 'done', 'closed')
  );

create or replace function public.enforce_work_order_update_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role      public.app_role := public.current_user_role();
  v_uid       uuid := auth.uid();
  v_reference public.work_orders;
begin
  -- Editors may change any column.
  if v_role in ('administrator', 'requester') then
    return new;
  end if;

  -- Everyone else (technician, inspector, supervisor, ...) may change only the
  -- status, and only when they are the assignee or creator. RLS independently
  -- restricts this path to rows already in the active workflow.
  if v_uid is not null and (v_uid = old.assigned_to or v_uid = old.created_by) then
    -- Copy the prior row, then overlay the columns this path is allowed to
    -- change. Any remaining difference means a forbidden column was touched.
    v_reference := old;
    v_reference.status     := new.status;
    v_reference.updated_by := new.updated_by;
    v_reference.updated_at := new.updated_at;

    if new is distinct from v_reference then
      raise exception 'You may only change the status of this work order'
        using errcode = '42501';
    end if;

    if new.status not in ('open', 'in_progress', 'done', 'closed') then
      raise exception 'Status must be Open, In Progress, Done, or Closed'
        using errcode = '42501';
    end if;

    return new;
  end if;

  raise exception 'You are not permitted to update this work order'
    using errcode = '42501';
end;
$$;
