-- Make administrator roles immutable via update.
-- An admin cannot change their own role, and no admin can change another admin's role.
-- Promoting a non-admin to administrator is still allowed; the row just becomes immutable afterward.

drop policy "Admins can update roles" on public.user_roles;

create policy "Admins can update non-admin roles"
  on public.user_roles
  for update
  using (
    public.current_user_role() = 'administrator'
    and user_id <> auth.uid()
    and role <> 'administrator'
  )
  with check (
    public.current_user_role() = 'administrator'
    and user_id <> auth.uid()
  );
