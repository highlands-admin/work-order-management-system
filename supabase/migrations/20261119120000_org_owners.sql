-- ---------------------------------------------------------------------------
-- Organization owners (Aravind, 2026-11-18)
--
-- Three levels above everyday users:
--   platform admin (Highlands)  creates organizations and names their owners
--   organization owner          an administrator who manages administrators
--   administrator               runs work orders and invites staff, but can
--                               no longer create, change, or remove
--                               administrators
--
-- Owner is a flag on an administrator's user_roles row, not a new role, so the
-- many checks for 'administrator' across the app and RLS are unchanged.
-- Triggers enforce the rules for every path:
--   * only owners (or platform admins) invite an administrator, promote
--     someone to administrator, or demote or remove an administrator;
--   * only platform admins grant or remove ownership, or touch an owner's row.
-- Changes made with no signed-in user (signup trigger, cron) are not checked.
--
-- Platform admins become owners of their own organization, so Highlands keeps
-- people who can manage its administrators.
--
-- Rollback outline:
--   drop the two guard triggers and their functions; drop
--   platform_set_org_owner and is_org_owner; restore handle_new_user,
--   admin_list_users, platform_invite_admin, platform_list_org_admins and
--   platform_list_admin_invitations from 20261118120000 and earlier; restore
--   the "Admins can update non-admin roles" policy from 20260930120000;
--   drop columns user_roles.is_owner and invitations.make_owner.
-- ---------------------------------------------------------------------------


-- columns

alter table public.user_roles
  add column if not exists is_owner boolean not null default false;

alter table public.invitations
  add column if not exists make_owner boolean not null default false;

comment on column public.user_roles.is_owner is
  'Organization owner: an administrator who may manage other administrators. Set by platform admins only.';
comment on column public.invitations.make_owner is
  'The invited administrator becomes an organization owner on signup. Platform admins only.';


-- whether the caller owns their organization

create or replace function public.is_org_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select ur.is_owner and ur.role = 'administrator'
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.organization_id = public.current_org_id()
  ), false);
$$;

revoke all on function public.is_org_owner() from public, anon;
grant execute on function public.is_org_owner() to authenticated;


-- guard: user_roles

create or replace function public.guard_role_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Signup and other system paths, and platform admins, are not limited.
  if auth.uid() is null or public.is_super_admin() then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.is_owner then
      raise exception 'Only Highlands can name organization owners.' using errcode = '42501';
    end if;
    if new.role = 'administrator' and not public.is_org_owner() then
      raise exception 'Only organization owners can add administrators.' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.is_owner then
      raise exception 'Only Highlands can remove an organization owner.' using errcode = '42501';
    end if;
    if old.role = 'administrator' and not public.is_org_owner() then
      raise exception 'Only organization owners can remove administrators.' using errcode = '42501';
    end if;
    return old;
  end if;

  -- UPDATE
  if new.is_owner is distinct from old.is_owner then
    raise exception 'Only Highlands can change organization owners.' using errcode = '42501';
  end if;
  if old.is_owner and new.role is distinct from old.role then
    raise exception 'Only Highlands can change an organization owner''s role.' using errcode = '42501';
  end if;
  if new.role is distinct from old.role
     and (old.role = 'administrator' or new.role = 'administrator')
     and not public.is_org_owner() then
    raise exception 'Only organization owners can promote or demote administrators.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_role_changes() from public, anon, authenticated;

drop trigger if exists guard_role_changes on public.user_roles;
create trigger guard_role_changes
  before insert or update or delete on public.user_roles
  for each row execute function public.guard_role_changes();


-- guard: invitations

create or replace function public.guard_admin_invitations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;

  if new.make_owner and (tg_op = 'INSERT' or not old.make_owner) then
    raise exception 'Only Highlands can invite organization owners.' using errcode = '42501';
  end if;
  if new.role = 'administrator'
     and (tg_op = 'INSERT' or old.role is distinct from 'administrator')
     and not public.is_org_owner() then
    raise exception 'Only organization owners can invite administrators.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_admin_invitations() from public, anon, authenticated;

drop trigger if exists guard_admin_invitations on public.invitations;
create trigger guard_admin_invitations
  before insert or update on public.invitations
  for each row execute function public.guard_admin_invitations();


-- RLS: owners may update administrators' rows (the trigger checks the rest)

drop policy "Admins can update non-admin roles" on public.user_roles;

create policy "Admins can update non-admin roles"
  on public.user_roles for update
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
    and user_id <> auth.uid()
    and (role <> 'administrator' or (select public.is_org_owner()))
  )
  with check (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
    and user_id <> auth.uid()
  );


-- signup: an owner invitation makes an owner

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.invitations%rowtype;
  v_org  uuid;
begin
  select i.* into invite
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where lower(i.email) = lower(new.email)
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
    and o.suspended_at is null
  order by i.created_at desc
  limit 1;

  if found then
    insert into public.user_roles (user_id, role, organization_id, is_owner)
    values (new.id, invite.role, invite.organization_id,
            invite.make_owner and invite.role = 'administrator');

    update public.invitations
    set accepted_at = now()
    where id = invite.id;
  else
    select o.id into v_org
    from public.organizations o
    where o.allowed_email_domain = lower(split_part(new.email, '@', 2))
      and o.suspended_at is null;

    if v_org is null then
      raise exception 'Signup requires an invitation or an email address from a registered organization domain.'
        using errcode = 'check_violation';
    end if;

    insert into public.user_roles (user_id, role, organization_id)
    values (new.id, 'requester', v_org);
  end if;

  return new;
end;
$$;


-- org admin user list: include the owner flag

drop function public.admin_list_users();

create function public.admin_list_users()
returns table (
  user_id          uuid,
  email            text,
  first_name       text,
  last_name        text,
  role             public.app_role,
  created_at       timestamptz,
  last_sign_in_at  timestamptz,
  is_owner         boolean
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
    u.last_sign_in_at,
    ur.is_owner
  from auth.users u
  inner join public.user_roles ur on ur.user_id = u.id
  where public.current_user_role() = 'administrator'
    and ur.organization_id = public.current_org_id()
  order by u.created_at desc;
$$;

revoke execute on function public.admin_list_users() from anon;


-- platform: invite as owner, list owners, grant or remove ownership

drop function public.platform_invite_admin(uuid, text, text, text, text, timestamptz);

create function public.platform_invite_admin(
  p_organization_id uuid,
  p_email           text,
  p_first_name      text,
  p_last_name       text,
  p_token           text,
  p_expires_at      timestamptz,
  p_make_owner      boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_super_admin();

  insert into public.invitations
    (organization_id, email, role, first_name, last_name, invited_by, token,
     expires_at, make_owner)
  values
    (p_organization_id, lower(trim(p_email)), 'administrator',
     nullif(trim(p_first_name), ''), nullif(trim(p_last_name), ''),
     auth.uid(), p_token, p_expires_at, coalesce(p_make_owner, false));
end;
$$;

drop function public.platform_list_org_admins(uuid);

create function public.platform_list_org_admins(p_organization_id uuid)
returns table (
  user_id         uuid,
  email           text,
  full_name       text,
  last_sign_in_at timestamptz,
  joined_at       timestamptz,
  is_owner        boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_super_admin();

  return query
  select
    u.id,
    u.email::text,
    nullif(trim(
      coalesce(u.raw_user_meta_data ->> 'first_name', '') || ' ' ||
      coalesce(u.raw_user_meta_data ->> 'last_name', '')), ''),
    u.last_sign_in_at,
    u.created_at,
    ur.is_owner
  from public.user_roles ur
  join auth.users u on u.id = ur.user_id
  where ur.organization_id = p_organization_id
    and ur.role = 'administrator'
    and ur.user_id not in (select d.user_id from public.demo_accounts d)
  order by ur.is_owner desc, u.created_at;
end;
$$;

drop function public.platform_list_admin_invitations(uuid);

create function public.platform_list_admin_invitations(p_organization_id uuid)
returns table (
  id          uuid,
  email       text,
  first_name  text,
  last_name   text,
  created_at  timestamptz,
  expires_at  timestamptz,
  accepted_at timestamptz,
  revoked_at  timestamptz,
  status      text,
  make_owner  boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_super_admin();

  return query
  select
    i.id, i.email, i.first_name, i.last_name,
    i.created_at, i.expires_at, i.accepted_at, i.revoked_at,
    case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at  is not null then 'revoked'
      when i.expires_at <= now()     then 'expired'
      else 'pending'
    end,
    i.make_owner
  from public.invitations i
  where i.organization_id = p_organization_id
    and i.role = 'administrator'
    and lower(i.email) not like 'demo+%@highlands.solutions'
  order by i.created_at desc;
end;
$$;

create or replace function public.platform_set_org_owner(
  p_organization_id uuid,
  p_user_id         uuid,
  p_is_owner        boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_super_admin();

  update public.user_roles
     set is_owner = p_is_owner
   where user_id = p_user_id
     and organization_id = p_organization_id
     and role = 'administrator'
     and user_id not in (select d.user_id from public.demo_accounts d);

  if not found then
    raise exception 'Only an administrator of this organization can be an owner.'
      using errcode = 'P0002';
  end if;
end;
$$;

do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.platform_invite_admin(uuid, text, text, text, text, timestamptz, boolean)',
    'public.platform_list_org_admins(uuid)',
    'public.platform_list_admin_invitations(uuid)',
    'public.platform_set_org_owner(uuid, uuid, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;
end $$;


-- seed: platform admins own their own organization

update public.user_roles ur
   set is_owner = true
 where ur.role = 'administrator'
   and ur.user_id in (select pa.user_id from public.platform_admins pa);
