-- Custom Access Token Hook.
-- After running this migration you MUST enable the hook in the Supabase Dashboard:
--   Authentication → Hooks → Custom Access Token → Select function
--   "public.custom_access_token_hook" → Save.
--
-- The hook stamps the user's role into the JWT as `user_role` on every token mint,
-- so RLS policies and Server Components can check it without querying user_roles.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims    jsonb := event->'claims';
  user_role public.app_role;
begin
  select role into user_role
  from public.user_roles
  where user_id = (event->>'user_id')::uuid;

  if user_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role::text));
  else
    claims := claims - 'user_role';
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- The auth admin role needs to read user_roles to look up the role for the hook.
grant select on table public.user_roles to supabase_auth_admin;

create policy "auth_admin can read for jwt hook"
  on public.user_roles
  as permissive
  for select
  to supabase_auth_admin
  using (true);
