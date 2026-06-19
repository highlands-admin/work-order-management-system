-- Recurring schedules: administrators may edit and delete any schedule;
-- requesters may edit and delete only the schedules they created. Other roles
-- cannot. Creation stays open to filers through the work order form.
drop policy if exists "Filers can update recurring work orders" on public.recurring_work_orders;
drop policy if exists "Filers can delete recurring work orders" on public.recurring_work_orders;
drop policy if exists "Admins can update recurring work orders" on public.recurring_work_orders;
drop policy if exists "Admins can delete recurring work orders" on public.recurring_work_orders;

create policy "Editors can update recurring work orders"
  on public.recurring_work_orders
  for update
  to authenticated
  using (
    public.current_user_role() = 'administrator'
    or (public.current_user_role() = 'requester' and created_by = auth.uid())
  )
  with check (
    public.current_user_role() = 'administrator'
    or (public.current_user_role() = 'requester' and created_by = auth.uid())
  );

create policy "Editors can delete recurring work orders"
  on public.recurring_work_orders
  for delete
  to authenticated
  using (
    public.current_user_role() = 'administrator'
    or (public.current_user_role() = 'requester' and created_by = auth.uid())
  );
