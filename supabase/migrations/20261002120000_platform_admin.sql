-- ---------------------------------------------------------------------------
-- Platform admin functions
--
-- Super admins create organizations, set their signup domain, invite their
-- first administrator, and manage their properties. They get no access to any
-- organization's work order data.
--
-- One rule keeps this safe: RLS only ever returns the caller's own
-- organization, including for super admins. Platform features go through the
-- platform_* functions below instead. Each checks is_super_admin() first and
-- acts on the single organization passed to it, so no ordinary app query can
-- pick up another organization's rows because the caller happens to be a
-- super admin.
--
-- That rule replaces the super admin clauses on organizations from
-- 20260930120000_multi_tenant_foundation.sql.
--
-- Rollback outline:
--   drop the functions below;
--   recreate the organizations policies from 20260930120000.
-- ---------------------------------------------------------------------------


-- ── organizations: own organization only ───────────────────────────────────

drop policy "Members read their organization" on public.organizations;
drop policy "Super admins create organizations" on public.organizations;
drop policy "Super admins update organizations" on public.organizations;
drop policy "Super admins delete organizations" on public.organizations;

create policy "Members read their organization"
  on public.organizations for select
  to authenticated
  using (id = (select public.current_org_id()));

-- Writes happen only through the platform functions.
revoke insert, update, delete on public.organizations from authenticated;


-- ── shared guard ───────────────────────────────────────────────────────────

create or replace function public.require_super_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only platform admins can do this'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.require_super_admin() from public, anon, authenticated;


-- ── organizations ──────────────────────────────────────────────────────────

-- Counts only, so the overview shows which organizations are set up without
-- exposing who their members are.
create or replace function public.platform_list_organizations()
returns table (
  id                   uuid,
  name                 text,
  slug                 text,
  allowed_email_domain text,
  member_count         integer,
  admin_count          integer,
  pending_admin_invites integer,
  created_at           timestamptz
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
    o.id,
    o.name,
    o.slug,
    o.allowed_email_domain,
    (select count(*)::int from public.user_roles ur
      where ur.organization_id = o.id),
    (select count(*)::int from public.user_roles ur
      where ur.organization_id = o.id and ur.role = 'administrator'),
    (select count(*)::int from public.invitations i
      where i.organization_id = o.id
        and i.role = 'administrator'
        and i.accepted_at is null
        and i.revoked_at is null
        and i.expires_at > now()),
    o.created_at
  from public.organizations o
  order by o.name;
end;
$$;

create or replace function public.platform_create_organization(
  p_name   text,
  p_slug   text,
  p_domain text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.require_super_admin();

  insert into public.organizations (name, slug, allowed_email_domain)
  values (trim(p_name), p_slug, nullif(lower(trim(p_domain)), ''))
  returning id into v_id;

  return v_id;
end;
$$;

-- The slug stays fixed after creation.
create or replace function public.platform_update_organization(
  p_id     uuid,
  p_name   text,
  p_domain text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_super_admin();

  update public.organizations
     set name = trim(p_name),
         allowed_email_domain = nullif(lower(trim(p_domain)), '')
   where id = p_id;

  if not found then
    raise exception 'Organization % does not exist', p_id
      using errcode = 'P0002';
  end if;
end;
$$;

-- Records an administrator invitation for the organization. The app generates
-- the token and sends the email, matching the org admin invite flow.
create or replace function public.platform_invite_admin(
  p_organization_id uuid,
  p_email           text,
  p_first_name      text,
  p_last_name       text,
  p_token           text,
  p_expires_at      timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_super_admin();

  insert into public.invitations
    (organization_id, email, role, first_name, last_name, invited_by, token, expires_at)
  values
    (p_organization_id, lower(trim(p_email)), 'administrator',
     nullif(trim(p_first_name), ''), nullif(trim(p_last_name), ''),
     auth.uid(), p_token, p_expires_at);
end;
$$;


-- ── properties ─────────────────────────────────────────────────────────────

create or replace function public.platform_list_properties(p_organization_id uuid)
returns table (
  key       text,
  name      text,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_super_admin();

  return query
  select p.key, p.name, p.is_active
  from public.properties p
  where p.organization_id = p_organization_id
  order by p.name;
end;
$$;

create or replace function public.platform_add_property(
  p_organization_id uuid,
  p_key             text,
  p_name            text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_super_admin();

  insert into public.properties (organization_id, key, name)
  values (p_organization_id, p_key, trim(p_name));
end;
$$;

-- Pass null for a field to leave it unchanged.
create or replace function public.platform_update_property(
  p_organization_id uuid,
  p_key             text,
  p_name            text,
  p_is_active       boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_super_admin();

  update public.properties
     set name = coalesce(trim(p_name), name),
         is_active = coalesce(p_is_active, is_active)
   where organization_id = p_organization_id
     and key = p_key;

  if not found then
    raise exception 'Property % does not exist in organization %', p_key, p_organization_id
      using errcode = 'P0002';
  end if;
end;
$$;


-- ── public signup ──────────────────────────────────────────────────────────

-- Lets the signup form tell a visitor whether their email domain allows
-- self-signup before it creates the account. Returns only a boolean, and the
-- same answer is already observable by attempting a signup, so it reveals
-- nothing new about which organizations exist.
create or replace function public.signup_domain_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organizations o
    where o.allowed_email_domain = lower(split_part(trim(p_email), '@', 2))
  );
$$;


-- ── grants ─────────────────────────────────────────────────────────────────

do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.platform_list_organizations()',
    'public.platform_create_organization(text, text, text)',
    'public.platform_update_organization(uuid, text, text)',
    'public.platform_invite_admin(uuid, text, text, text, text, timestamptz)',
    'public.platform_list_properties(uuid)',
    'public.platform_add_property(uuid, text, text)',
    'public.platform_update_property(uuid, text, text, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;
end $$;

revoke all on function public.signup_domain_allowed(text) from public;
grant execute on function public.signup_domain_allowed(text) to anon, authenticated;
