-- ---------------------------------------------------------------------------
-- Platform controls: pause an organization, read-only demo accounts, and
-- invitation status (Aravind, 2026-11-18).
--
-- 1. Pausing an organization (organizations.suspended_at)
--    current_org_id() returns null for a paused organization, so every RLS
--    policy already scoped to it returns nothing and refuses every write, with
--    no change to the policies themselves. The access token carries an
--    org_suspended claim so the app can show a "paused" page instead of an
--    empty one. Pausing also cancels pending invitations, ends the members'
--    sessions, stops recurring generation and reminder emails, and refuses new
--    signups. Unpausing restores everything; no data is touched.
--
-- 2. Demo accounts (public.demo_accounts)
--    One per organization, created by a platform admin. It is an administrator
--    of that organization, so it sees what the organization's administrators
--    see, but a trigger on every tenant table refuses its writes. The access
--    token carries a demo claim so the app can show a banner. Platform admins
--    still cannot read any organization's data as themselves.
--
-- 3. Invitation status for platform admins
--    platform_list_admin_invitations and platform_list_org_admins show who was
--    invited as an administrator, whether they accepted, and when each
--    administrator last signed in. Members other than administrators stay
--    counts only.
--
-- Rollback outline:
--   drop the zz_block_demo_writes triggers and public.block_demo_writes();
--   drop table public.demo_accounts; drop the platform_* functions added here;
--   restore current_org_id, custom_access_token_hook, handle_new_user,
--   signup_domain_allowed, invitation_by_token,
--   generate_due_recurring_work_orders, recurring_work_orders_due_for_reminder
--   and platform_list_organizations from their previous migrations;
--   alter table public.organizations drop column suspended_at.
-- ---------------------------------------------------------------------------


-- organizations.suspended_at

alter table public.organizations
  add column if not exists suspended_at timestamptz;

comment on column public.organizations.suspended_at is
  'When a platform admin paused the organization. Null means active.';


-- demo accounts

create table public.demo_accounts (
  organization_id uuid        primary key references public.organizations(id) on delete cascade,
  user_id         uuid        not null unique references auth.users(id) on delete cascade,
  created_by      uuid        references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- Read and written only through the security definer functions below.
alter table public.demo_accounts enable row level security;
revoke all on public.demo_accounts from anon, authenticated;

create or replace function public.is_demo_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.demo_accounts d where d.user_id = auth.uid()
  );
$$;

revoke all on function public.is_demo_user() from public, anon;
grant execute on function public.is_demo_user() to authenticated;

-- Refuses any change made by a signed-in demo account. Changes made with no
-- signed-in user (cron jobs, signup triggers, the service role) pass.
create or replace function public.block_demo_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and public.is_demo_user() then
    raise exception 'Demo accounts are read-only.'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.block_demo_writes() from public, anon, authenticated;

-- Every table in public except the demo user's own notification read state
-- and the demo table itself.
do $$
declare
  v_table text;
begin
  for v_table in
    select c.relname
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind = 'r'
      and c.relname not in ('notifications', 'demo_accounts')
  loop
    execute format('drop trigger if exists zz_block_demo_writes on public.%I', v_table);
    execute format(
      'create trigger zz_block_demo_writes before insert or update or delete on public.%I
         for each row execute function public.block_demo_writes()',
      v_table
    );
  end loop;
end $$;


-- current_org_id: nothing for a paused organization

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select o.id
  from public.organizations o
  where o.id = coalesce(
          nullif(auth.jwt() ->> 'org_id', '')::uuid,
          (select ur.organization_id from public.user_roles ur where ur.user_id = auth.uid())
        )
    and o.suspended_at is null;
$$;


-- access token claims

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims    jsonb := event->'claims';
  v_user    uuid  := (event->>'user_id')::uuid;
  user_role public.app_role;
  org_id    uuid;
  v_paused  boolean;
begin
  select ur.role, ur.organization_id, (o.suspended_at is not null)
    into user_role, org_id, v_paused
  from public.user_roles ur
  join public.organizations o on o.id = ur.organization_id
  where ur.user_id = v_user;

  claims := claims - 'user_role' - 'org_id' - 'org_suspended' - 'demo';

  if user_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role::text));
    claims := jsonb_set(claims, '{org_id}', to_jsonb(org_id::text));
    if v_paused then
      claims := jsonb_set(claims, '{org_suspended}', 'true'::jsonb);
    end if;
    if exists (select 1 from public.demo_accounts d where d.user_id = v_user) then
      claims := jsonb_set(claims, '{demo}', 'true'::jsonb);
    end if;
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;


-- signups: never into a paused organization

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
    insert into public.user_roles (user_id, role, organization_id)
    values (new.id, invite.role, invite.organization_id);

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
      and o.suspended_at is null
  );
$$;

create or replace function public.invitation_by_token(p_token text)
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
    and o.suspended_at is null
  limit 1;
$$;


-- recurring work: nothing generated or emailed for a paused organization

create or replace function public.generate_due_recurring_work_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r          record;
  v_created  integer := 0;
  v_step     interval;
begin
  for r in
    select t.*
    from public.recurring_work_orders t
    join public.organizations o on o.id = t.organization_id
    where t.active
      and o.suspended_at is null
      and t.next_due_at is not null
      and t.next_due_at <= now() + make_interval(days => t.generation_lead_days)
  loop
    if not exists (
      select 1
      from public.work_orders w
      where w.recurring_work_order_id = r.id
        and w.due_at = r.next_due_at
    ) then
      insert into public.work_orders (
        organization_id,
        title, category, priority, property, unit_number, description,
        provider, assigned_to, due_at, status,
        recurring_work_order_id, notify_recipients, created_by, updated_by
      ) values (
        r.organization_id,
        r.title, r.category, r.priority, r.property, r.unit_number, r.description,
        r.provider, r.assigned_to, r.next_due_at, 'open',
        r.id, coalesce(r.reminder_recipients, '{}'::uuid[]), r.created_by, r.created_by
      );
      v_created := v_created + 1;
    end if;

    if r.frequency = 'one_time' then
      update public.recurring_work_orders
        set next_due_at = null,
            active = false,
            updated_by = r.created_by
        where id = r.id;
    else
      v_step := (case r.frequency
        when 'weekly'     then interval '1 week'
        when 'monthly'    then interval '1 month'
        when 'quarterly'  then interval '3 months'
        when 'semiannual' then interval '6 months'
        when 'annual'     then interval '1 year'
      end) * r.recurrence_interval;

      update public.recurring_work_orders
        set next_due_at = r.next_due_at + v_step,
            updated_by = r.created_by
        where id = r.id;
    end if;
  end loop;

  return v_created;
end;
$$;

create or replace function public.recurring_work_orders_due_for_reminder()
returns table (
  id              uuid,
  work_order_code text,
  title           text,
  category        public.work_order_category,
  priority        public.work_order_priority,
  status          public.work_order_status,
  property        text,
  property_name   text,
  unit_number     text,
  due_at          timestamptz,
  description     text,
  provider        text,
  lead_days       integer,
  recipients      jsonb
)
language sql
security definer
set search_path = ''
as $$
  select
    w.id,
    w.work_order_code,
    w.title,
    w.category,
    w.priority,
    w.status,
    w.property,
    p.name,
    w.unit_number,
    w.due_at,
    w.description,
    w.provider,
    lead.lead_days,
    (
      select coalesce(
        jsonb_agg(jsonb_build_object(
          'email', u.email,
          'first_name', nullif(trim(coalesce(u.raw_user_meta_data ->> 'first_name', '')), '')
        )),
        '[]'::jsonb
      )
      from auth.users u
      where u.id = any (t.reminder_recipients)
        and u.email is not null
    ) as recipients
  from public.work_orders w
  join public.recurring_work_orders t on t.id = w.recurring_work_order_id
  join public.organizations org
    on org.id = w.organization_id
   and org.suspended_at is null
  left join public.properties p
    on p.organization_id = w.organization_id
   and p.key = w.property
  cross join lateral unnest(t.reminder_lead_days) as lead(lead_days)
  where w.recurring_work_order_id is not null
    and w.status in ('open', 'in_progress', 'on_hold')
    and w.due_at is not null
    and coalesce(array_length(t.reminder_recipients, 1), 0) >= 1
    and lead.lead_days <> all (w.reminder_sent_lead_days)
    and now() >= w.due_at - make_interval(days => lead.lead_days)
    and (
      now() < w.due_at + interval '1 day'
      or coalesce(array_length(w.reminder_sent_lead_days, 1), 0) = 0
    )
$$;

revoke all on function public.recurring_work_orders_due_for_reminder() from public, anon, authenticated;
grant execute on function public.recurring_work_orders_due_for_reminder() to service_role;


-- platform functions

-- The return type changes, so the function must be dropped and recreated.
drop function public.platform_list_organizations();

create function public.platform_list_organizations()
returns table (
  id                    uuid,
  name                  text,
  slug                  text,
  allowed_email_domain  text,
  member_count          integer,
  admin_count           integer,
  pending_admin_invites integer,
  created_at            timestamptz,
  suspended_at          timestamptz,
  has_demo              boolean,
  is_own                boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_own uuid;
begin
  perform public.require_super_admin();

  select ur.organization_id into v_own
  from public.user_roles ur where ur.user_id = auth.uid();

  return query
  select
    o.id,
    o.name,
    o.slug,
    o.allowed_email_domain,
    (select count(*)::int from public.user_roles ur
      where ur.organization_id = o.id
        and ur.user_id not in (select d.user_id from public.demo_accounts d)),
    (select count(*)::int from public.user_roles ur
      where ur.organization_id = o.id and ur.role = 'administrator'
        and ur.user_id not in (select d.user_id from public.demo_accounts d)),
    (select count(*)::int from public.invitations i
      where i.organization_id = o.id
        and i.role = 'administrator'
        and i.accepted_at is null
        and i.revoked_at is null
        and i.expires_at > now()),
    o.created_at,
    o.suspended_at,
    exists (select 1 from public.demo_accounts d where d.organization_id = o.id),
    o.id = v_own
  from public.organizations o
  order by o.name;
end;
$$;

-- Administrator invitations for one organization, newest first, with a
-- status the page can show as is. Demo account invitations are left out.
create or replace function public.platform_list_admin_invitations(p_organization_id uuid)
returns table (
  id          uuid,
  email       text,
  first_name  text,
  last_name   text,
  created_at  timestamptz,
  expires_at  timestamptz,
  accepted_at timestamptz,
  revoked_at  timestamptz,
  status      text
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
    end
  from public.invitations i
  where i.organization_id = p_organization_id
    and i.role = 'administrator'
    and lower(i.email) not like 'demo+%@highlands.solutions'
  order by i.created_at desc;
end;
$$;

-- The organization's administrators and when each last signed in.
create or replace function public.platform_list_org_admins(p_organization_id uuid)
returns table (
  user_id         uuid,
  email           text,
  full_name       text,
  last_sign_in_at timestamptz,
  joined_at       timestamptz
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
    u.created_at
  from public.user_roles ur
  join auth.users u on u.id = ur.user_id
  where ur.organization_id = p_organization_id
    and ur.role = 'administrator'
    and ur.user_id not in (select d.user_id from public.demo_accounts d)
  order by u.created_at;
end;
$$;

create or replace function public.platform_revoke_invitation(
  p_organization_id uuid,
  p_invitation_id   uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_super_admin();

  update public.invitations
     set revoked_at = now()
   where id = p_invitation_id
     and organization_id = p_organization_id
     and accepted_at is null
     and revoked_at is null;

  if not found then
    raise exception 'That invitation is no longer pending.'
      using errcode = 'P0002';
  end if;
end;
$$;

-- Pauses or resumes an organization. A platform admin cannot pause the
-- organization they belong to, which would lock them out of this page.
create or replace function public.platform_set_organization_suspended(
  p_organization_id uuid,
  p_suspended       boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_super_admin();

  if p_suspended and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.organization_id = p_organization_id
  ) then
    raise exception 'You cannot pause your own organization.'
      using errcode = '42501';
  end if;

  update public.organizations
     set suspended_at = case when p_suspended then coalesce(suspended_at, now()) else null end
   where id = p_organization_id;

  if not found then
    raise exception 'Organization % does not exist', p_organization_id
      using errcode = 'P0002';
  end if;

  if p_suspended then
    update public.invitations
       set revoked_at = now()
     where organization_id = p_organization_id
       and accepted_at is null
       and revoked_at is null;

    -- Signs every member out, so their next sign-in gets the paused claim.
    delete from auth.refresh_tokens
     where user_id in (
       select ur.user_id::text from public.user_roles ur
       where ur.organization_id = p_organization_id);
    delete from auth.sessions
     where user_id in (
       select ur.user_id from public.user_roles ur
       where ur.organization_id = p_organization_id);
  end if;
end;
$$;

-- Step 1 of creating a demo account: the administrator invitation its signup
-- consumes. The app then creates the auth user (which runs handle_new_user)
-- and calls platform_register_demo.
create or replace function public.platform_prepare_demo(
  p_organization_id uuid,
  p_email           text,
  p_token           text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_super_admin();

  if exists (select 1 from public.demo_accounts d where d.organization_id = p_organization_id) then
    raise exception 'This organization already has a demo account.'
      using errcode = '23505';
  end if;

  -- A failed earlier attempt can leave its invitation behind.
  update public.invitations
     set revoked_at = now()
   where organization_id = p_organization_id
     and lower(email) = lower(trim(p_email))
     and accepted_at is null
     and revoked_at is null;

  insert into public.invitations
    (organization_id, email, role, first_name, last_name, invited_by, token, expires_at)
  values
    (p_organization_id, lower(trim(p_email)), 'administrator', 'Demo', 'Viewer',
     auth.uid(), p_token, now() + interval '1 hour');
end;
$$;

create or replace function public.platform_register_demo(
  p_organization_id uuid,
  p_user_id         uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_super_admin();

  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.organization_id = p_organization_id
      and ur.role = 'administrator'
  ) then
    raise exception 'The demo user did not join this organization.'
      using errcode = '42501';
  end if;

  insert into public.demo_accounts (organization_id, user_id, created_by)
  values (p_organization_id, p_user_id, auth.uid());
end;
$$;

-- The demo user's email, for the app to sign in as it.
create or replace function public.platform_demo_email(p_organization_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  perform public.require_super_admin();

  select u.email into v_email
  from public.demo_accounts d
  join auth.users u on u.id = d.user_id
  where d.organization_id = p_organization_id;

  return v_email;
end;
$$;


-- grants

do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.platform_list_organizations()',
    'public.platform_list_admin_invitations(uuid)',
    'public.platform_list_org_admins(uuid)',
    'public.platform_revoke_invitation(uuid, uuid)',
    'public.platform_set_organization_suspended(uuid, boolean)',
    'public.platform_prepare_demo(uuid, text, text)',
    'public.platform_register_demo(uuid, uuid)',
    'public.platform_demo_email(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;
end $$;
