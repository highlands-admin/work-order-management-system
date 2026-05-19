-- Approval queue: columns, RLS, and the trigger that enforces approval
-- transitions.
--
-- Workflow:
--   requester submits              ->  status = 'pending'
--   administrator submits          ->  status = 'open' (no approval needed)
--   administrator approves         ->  status moves from 'pending' to 'open'
--   administrator rejects          ->  status moves from 'pending' to 'rejected'
--                                      and (rejected_reason, rejected_at,
--                                      rejected_by) are stamped
--
-- Pending and rejected rows are visible to the administrator and to the
-- original creator only. Technicians, inspectors, and other editors do not
-- see un-approved work in their lists until the admin promotes it.

alter table public.work_orders
  add column if not exists rejected_reason text,
  add column if not exists rejected_at     timestamptz,
  add column if not exists rejected_by     uuid references auth.users(id) on delete set null;

create index if not exists work_orders_pending_idx
  on public.work_orders (created_at desc)
  where status = 'pending';

-- Replace the wide-open SELECT policy. The new policy keeps admins
-- unrestricted, lets everyone else see approved work (open / assigned /
-- in_progress / done / closed), and additionally shows each creator their
-- own pending and rejected submissions so they can see what they sent in.

drop policy if exists "Authenticated users can read work orders"
  on public.work_orders;

create policy "Authenticated users can read work orders"
  on public.work_orders
  for select
  to authenticated
  using (
    public.current_user_role() = 'administrator'
    or status not in ('pending', 'rejected')
    or created_by = auth.uid()
  );

-- Replace the INSERT policy so each role is forced into the right starting
-- status. The application also branches on role, but RLS is the boundary of
-- record: a hand-crafted request that tries to skip approval will be denied.

drop policy if exists "Filers can insert work orders" on public.work_orders;

create policy "Filers can insert work orders"
  on public.work_orders
  for insert
  to authenticated
  with check (
    public.current_user_role() in ('administrator', 'requester')
    and created_by = auth.uid()
    and updated_by = auth.uid()
    and resolution is null
    and (
      (public.current_user_role() = 'administrator' and status = 'open')
      or (public.current_user_role() = 'requester' and status = 'pending')
    )
  );

-- Approval transitions trigger. The existing editor UPDATE policy still
-- permits administrators and requesters to update work orders; this trigger
-- narrows what each non-admin role may do with the approval states. Admins
-- are unrestricted.

create or replace function public.enforce_work_order_approval_transitions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role := public.current_user_role();
begin
  if v_role = 'administrator' then
    return new;
  end if;

  -- Pending and rejected rows are only editable by their creator (or by an
  -- administrator, which short-circuited above). Other requesters cannot
  -- quietly edit someone else's queued submission.
  if old.status in ('pending', 'rejected')
     and old.created_by is distinct from auth.uid() then
    raise exception 'Only the creator or an administrator can edit a % work order', old.status
      using errcode = '42501';
  end if;

  -- Only an administrator can move a work order into pending or rejected.
  if new.status in ('pending', 'rejected')
     and old.status is distinct from new.status then
    raise exception 'Only administrators can move a work order into the % state', new.status
      using errcode = '42501';
  end if;

  -- Only an administrator can transition a row out of pending or rejected.
  if old.status in ('pending', 'rejected')
     and old.status is distinct from new.status then
    raise exception 'Only administrators can transition a % work order', old.status
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_work_order_approval_transitions()
  from public;

create trigger work_orders_enforce_approval_transitions
  before update on public.work_orders
  for each row execute function public.enforce_work_order_approval_transitions();
