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
