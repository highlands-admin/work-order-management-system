-- Function for the admin /admin/users page.
-- auth.users isn't exposed to PostgREST, so admins can't query it directly through
-- supabase-js. This SECURITY DEFINER function joins users + roles and returns the
-- data, but only when the caller's JWT carries the administrator role.

create or replace function public.admin_list_users()
returns table (
  user_id          uuid,
  email            text,
  first_name       text,
  last_name        text,
  role             public.app_role,
  created_at       timestamptz,
  last_sign_in_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    u.email,
    (u.raw_user_meta_data ->> 'first_name'),
    (u.raw_user_meta_data ->> 'last_name'),
    ur.role,
    u.created_at,
    u.last_sign_in_at
  from auth.users u
  left join public.user_roles ur on ur.user_id = u.id
  where public.current_user_role() = 'administrator'
  order by u.created_at desc;
$$;

revoke execute on function public.admin_list_users() from public;
grant  execute on function public.admin_list_users() to authenticated;

-- Lightweight directory used to populate the "Assignee" dropdown on the work
-- order forms. Any authenticated user can read this so requesters can also
-- assign their submissions. Returns email as a fallback label for users who
-- haven't filled in a name yet (e.g., the bootstrap admin).
create or replace function public.list_assignable_users()
returns table (
  user_id    uuid,
  email      text,
  first_name text,
  last_name  text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ur.user_id,
    u.email,
    (u.raw_user_meta_data ->> 'first_name'),
    (u.raw_user_meta_data ->> 'last_name')
  from public.user_roles ur
  inner join auth.users u on u.id = ur.user_id
  order by
    coalesce(
      nullif(trim(
        coalesce(u.raw_user_meta_data ->> 'first_name', '')
        || ' '
        || coalesce(u.raw_user_meta_data ->> 'last_name', '')
      ), ''),
      u.email
    );
$$;

revoke execute on function public.list_assignable_users() from public;
grant  execute on function public.list_assignable_users() to authenticated;
