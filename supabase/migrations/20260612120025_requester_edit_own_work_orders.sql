-- Restrict requesters to editing only the work orders they created or are
-- assigned to. Administrators keep unrestricted update access.
--
-- The previous "Editors can update work orders" policy (migration
-- 20260513120009) let every administrator and requester update any row. This
-- replaces it so a requester may only touch rows where they are the creator or
-- the assignee. The technician and inspector policies, and the column
-- immutability trigger, are unchanged.
--
-- An UPDATE in Postgres RLS must also pass a SELECT policy to read the row;
-- "Authenticated users can read work orders" (using true) already provides
-- that, so a requester can still load any row but can only persist changes to
-- their own.

drop policy "Editors can update work orders" on public.work_orders;

create policy "Editors can update work orders"
  on public.work_orders
  for update
  to authenticated
  using (
    public.current_user_role() = 'administrator'
    or (
      public.current_user_role() = 'requester'
      and (created_by = auth.uid() or assigned_to = auth.uid())
    )
  )
  with check (
    updated_by = auth.uid()
    and (
      public.current_user_role() = 'administrator'
      or (
        public.current_user_role() = 'requester'
        and (created_by = auth.uid() or assigned_to = auth.uid())
      )
    )
  );
