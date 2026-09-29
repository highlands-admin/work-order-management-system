-- ---------------------------------------------------------------------------
-- Invitation details for the one-organization-per-account model
--
-- Each account belongs to exactly one organization, and handle_new_user only
-- applies an invitation when the account is first created. An invitation sent
-- to an email that already has an account can never be used.
--
-- invitation_by_token now also returns the organization name and whether the
-- email already has an account, so the accept page can explain the situation
-- instead of failing silently. Only the holder of the token, who is the
-- invitee, can call it for a given invitation, so this reveals nothing about
-- other people's accounts.
--
-- platform_email_has_account lets platform admins check before sending. Org
-- administrators do not get this check, because it would reveal which emails
-- have accounts in other organizations.
--
-- Rollback: restore invitation_by_token from
-- 20260513120002_invitations.sql and drop platform_email_has_account.
-- ---------------------------------------------------------------------------

-- The return type changes, so the function must be dropped and recreated.
drop function public.invitation_by_token(text);

create function public.invitation_by_token(p_token text)
returns table (
  email             text,
  role              public.app_role,
  first_name        text,
  last_name         text,
  organization_name text,
  account_exists    boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.email,
    i.role,
    i.first_name,
    i.last_name,
    o.name,
    exists (select 1 from auth.users u where lower(u.email) = lower(i.email))
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token = p_token
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
  limit 1;
$$;

revoke all on function public.invitation_by_token(text) from public;
grant execute on function public.invitation_by_token(text) to anon, authenticated;

create or replace function public.platform_email_has_account(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_super_admin();

  return exists (
    select 1 from auth.users u where lower(u.email) = lower(trim(p_email))
  );
end;
$$;

revoke all on function public.platform_email_has_account(text) from public, anon;
grant execute on function public.platform_email_has_account(text) to authenticated;
