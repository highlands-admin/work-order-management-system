-- App role enum and user_roles table with RLS.
-- Roles map to job functions in a work-order workflow:
--   administrator: full access, manages users and roles, approves work orders
--   requester:     files work orders (submissions enter an admin approval queue)
--   technician:    assigned to and performs the work
--   inspector:     verifies completion and closes the ticket

create type public.app_role as enum (
  'administrator',
  'requester',
  'technician',
  'inspector'
);

create table public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       public.app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Read the current user's role from the JWT claim stamped by the access token hook.
-- Returns null if no role is set.
create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'user_role', '')::public.app_role;
$$;

revoke execute on function public.current_user_role() from public;
grant  execute on function public.current_user_role() to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_roles_set_updated_at
  before update on public.user_roles
  for each row execute function public.set_updated_at();

alter table public.user_roles enable row level security;

create policy "Users can read their own role"
  on public.user_roles
  for select
  using (auth.uid() = user_id);

create policy "Admins can read all roles"
  on public.user_roles
  for select
  using (public.current_user_role() = 'administrator');

create policy "Admins can insert roles"
  on public.user_roles
  for insert
  with check (public.current_user_role() = 'administrator');

create policy "Admins can update roles"
  on public.user_roles
  for update
  using (public.current_user_role() = 'administrator')
  with check (public.current_user_role() = 'administrator');

create policy "Admins can delete roles"
  on public.user_roles
  for delete
  using (public.current_user_role() = 'administrator');
