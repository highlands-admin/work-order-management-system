-- Bootstrap administrator invitation.
--
-- SETUP STEPS:
-- 1. Replace 'REPLACE_ME@example.com' below with the email of your first administrator.
-- 2. Apply migrations (supabase db push).
-- 3. Visit /accept-invite?token=__bootstrap__ in your app and complete signup with that email.
-- 4. After signup, the invitation is auto-marked accepted by the signup trigger.
--
-- The token is intentionally short and predictable. It's only useful for the first signup
-- and becomes inert once accepted. If you don't trust the deployment environment, generate
-- a random token instead and use that in the URL.

insert into public.invitations (
  email,
  role,
  first_name,
  last_name,
  token,
  expires_at
)
values (
  'kaushik.m@highlands.care',
  'administrator',
  null,
  null,
  '__bootstrap__',
  now() + interval '30 days'
)
on conflict (token) do nothing;
