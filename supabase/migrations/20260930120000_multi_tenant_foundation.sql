-- ---------------------------------------------------------------------------
-- Multi-tenant foundation
--
-- Every row in the work order tables now belongs to exactly one organization,
-- and every RLS policy limits reads and writes to the caller's organization.
-- Each user belongs to one organization, recorded on user_roles and stamped
-- into the access token as the org_id claim.
--
-- All existing data belongs to a single organization, so the backfill creates
-- it and stamps every row with its id.
--
-- How organization_id gets set on insert:
--   work_orders, recurring_work_orders, invitations, category_approvers,
--   user_roles        default current_org_id() (the caller's organization)
--   work_order_notes, work_order_attachments, work_order_activity
--                     copied from the parent work order by a trigger, which
--                     overrides whatever the client sent
--   notifications     copied from the recipient's user_roles row by a trigger
-- The cron job that generates recurring work orders has no caller, so it sets
-- organization_id explicitly from the schedule.
--
-- SECURITY DEFINER functions bypass RLS, so each one that reads tenant data
-- now filters by organization itself.
--
-- Rollback outline (restore each replaced function and policy from the
-- migration that last defined it, then):
--   alter table <each tenant table> drop column organization_id;
--   drop function public.current_org_id(), public.is_super_admin(),
--     public.set_org_from_work_order(), public.set_notification_org(),
--     public.enforce_same_org_users();
--   drop table public.platform_admins, public.organizations;
-- ---------------------------------------------------------------------------


-- ── organizations ──────────────────────────────────────────────────────────

create table public.organizations (
  id                   uuid        primary key default gen_random_uuid(),
  name                 text        not null check (length(trim(name)) > 0),
  slug                 text        not null unique
                                     check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- New users whose email domain matches join this organization as
  -- requesters without an invitation. Null means invitation only.
  allowed_email_domain text        unique
                                     check (allowed_email_domain = lower(allowed_email_domain)),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();


-- ── platform admins ────────────────────────────────────────────────────────
-- Super admins who create and manage organizations. They sit outside the
-- per-organization roles. Rows are added by migration or by SQL run as the
-- postgres role, never through the app.

create table public.platform_admins (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);


-- ── add organization_id and backfill ───────────────────────────────────────

insert into public.organizations (name, slug, allowed_email_domain)
values ('Highlands', 'highlands', 'highlands.care');

do $$
declare
  v_org uuid := (select id from public.organizations where slug = 'highlands');
  v_table text;
begin
  foreach v_table in array array[
    'user_roles', 'invitations', 'work_orders', 'recurring_work_orders',
    'work_order_notes', 'work_order_attachments', 'work_order_activity',
    'notifications', 'category_approvers'
  ] loop
    execute format(
      'alter table public.%I add column organization_id uuid
         references public.organizations(id) on delete restrict',
      v_table
    );
    -- The backfill is bookkeeping, so user triggers must not see it. With
    -- them on, the work order guards reject the update (a migration has no
    -- signed-in role), updated_at bumps on every row, and the activity log
    -- records a change per row. DISABLE TRIGGER USER leaves the foreign key
    -- triggers running.
    execute format('alter table public.%I disable trigger user', v_table);
    execute format('update public.%I set organization_id = %L', v_table, v_org);
    execute format('alter table public.%I enable trigger user', v_table);
    execute format('alter table public.%I alter column organization_id set not null', v_table);
    execute format(
      'create index %I on public.%I (organization_id)',
      v_table || '_organization_id_idx', v_table
    );
  end loop;
end $$;

-- ── helper functions ───────────────────────────────────────────────────────

-- The caller's organization. Reads the org_id claim first. Falls back to
-- user_roles for access tokens issued before this migration, which lack the
-- claim until they refresh. SECURITY DEFINER so the fallback can read
-- user_roles from inside user_roles policies without recursing.
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'org_id', '')::uuid,
    (select ur.organization_id from public.user_roles ur where ur.user_id = auth.uid())
  );
$$;

revoke all on function public.current_org_id() from public, anon;
grant execute on function public.current_org_id() to authenticated;

-- Whether the caller is a platform super admin. A table lookup instead of a
-- token claim, so granting or revoking takes effect immediately.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins pa where pa.user_id = auth.uid()
  );
$$;

revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;


-- Tables whose rows are created by a signed-in user default to that user's
-- organization. The rest are set by the triggers below.
alter table public.user_roles            alter column organization_id set default public.current_org_id();
alter table public.invitations           alter column organization_id set default public.current_org_id();
alter table public.work_orders           alter column organization_id set default public.current_org_id();
alter table public.recurring_work_orders alter column organization_id set default public.current_org_id();
alter table public.category_approvers    alter column organization_id set default public.current_org_id();

-- Approvers are chosen per organization for the shared categories.
alter table public.category_approvers drop constraint category_approvers_pkey;
alter table public.category_approvers add primary key (organization_id, category, user_id);


-- ── triggers that stamp organization_id ────────────────────────────────────

-- Notes, attachments, and activity inherit the parent work order's
-- organization. The trigger overrides any client-supplied value, so a caller
-- cannot file a child row under another organization. An insert against
-- another organization's work order gets that organization's id here and is
-- then rejected by the RLS check.
create or replace function public.set_org_from_work_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select wo.organization_id into new.organization_id
  from public.work_orders wo
  where wo.id = new.work_order_id;

  if new.organization_id is null then
    raise exception 'Work order % does not exist', new.work_order_id
      using errcode = '23503';
  end if;

  return new;
end;
$$;

revoke all on function public.set_org_from_work_order() from public, anon, authenticated;

create trigger work_order_notes_set_org
  before insert on public.work_order_notes
  for each row execute function public.set_org_from_work_order();

create trigger work_order_attachments_set_org
  before insert on public.work_order_attachments
  for each row execute function public.set_org_from_work_order();

create trigger work_order_activity_set_org
  before insert on public.work_order_activity
  for each row execute function public.set_org_from_work_order();

-- Notifications take the recipient's organization. The notification is
-- dropped (the trigger returns null) when the recipient has no organization or
-- belongs to a different one than the work order it refers to, so no trigger
-- path can notify someone outside the work order's organization.
create or replace function public.set_notification_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work_order_org uuid;
begin
  select ur.organization_id into new.organization_id
  from public.user_roles ur
  where ur.user_id = new.user_id;

  if new.organization_id is null then
    return null;
  end if;

  if new.work_order_id is not null then
    select wo.organization_id into v_work_order_org
    from public.work_orders wo
    where wo.id = new.work_order_id;

    if v_work_order_org is distinct from new.organization_id then
      return null;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.set_notification_org() from public, anon, authenticated;

create trigger notifications_set_org
  before insert on public.notifications
  for each row execute function public.set_notification_org();

-- Assignees and notification recipients must belong to the row's
-- organization. Without this a caller who knows another organization's user
-- id could assign them work or add them as a recipient. Skipped on updates
-- that leave those columns alone, so unrelated edits never fail.
create or replace function public.enforce_same_org_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipients     uuid[];
  v_old_recipients uuid[];
begin
  if tg_table_name = 'work_orders' then
    v_recipients := new.notify_recipients;
    if tg_op = 'UPDATE' then
      v_old_recipients := old.notify_recipients;
    end if;
  else
    v_recipients := new.reminder_recipients;
    if tg_op = 'UPDATE' then
      v_old_recipients := old.reminder_recipients;
    end if;
  end if;

  if tg_op = 'UPDATE'
     and new.organization_id is not distinct from old.organization_id
     and new.assigned_to is not distinct from old.assigned_to
     and v_recipients is not distinct from v_old_recipients then
    return new;
  end if;

  if exists (
    select 1
    from unnest(array[new.assigned_to] || coalesce(v_recipients, '{}'::uuid[])) as member(user_id)
    where member.user_id is not null
      and not exists (
        select 1
        from public.user_roles ur
        where ur.user_id = member.user_id
          and ur.organization_id = new.organization_id
      )
  ) then
    raise exception 'Assignees and recipients must belong to the same organization'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_same_org_users() from public, anon, authenticated;

create trigger work_orders_enforce_same_org_users
  before insert or update on public.work_orders
  for each row execute function public.enforce_same_org_users();

create trigger recurring_work_orders_enforce_same_org_users
  before insert or update on public.recurring_work_orders
  for each row execute function public.enforce_same_org_users();


-- ── RLS: organizations and platform_admins ─────────────────────────────────

alter table public.organizations enable row level security;

create policy "Members read their organization"
  on public.organizations for select
  to authenticated
  using (id = (select public.current_org_id()) or (select public.is_super_admin()));

create policy "Super admins create organizations"
  on public.organizations for insert
  to authenticated
  with check ((select public.is_super_admin()));

create policy "Super admins update organizations"
  on public.organizations for update
  to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));

create policy "Super admins delete organizations"
  on public.organizations for delete
  to authenticated
  using ((select public.is_super_admin()));

grant select, insert, update, delete on public.organizations to authenticated;

-- No write policies: platform admins are managed outside the app.
alter table public.platform_admins enable row level security;

create policy "Users read their own platform admin row"
  on public.platform_admins for select
  to authenticated
  using (user_id = auth.uid());

grant select on public.platform_admins to authenticated;


-- ── RLS: rewrite every tenant policy ───────────────────────────────────────
-- Each policy keeps its existing role logic and gains an organization check.
-- current_org_id() is wrapped in a scalar subquery so Postgres evaluates it
-- once per statement instead of once per row.

-- category_approvers
drop policy "category_approvers_select_admin" on public.category_approvers;
drop policy "category_approvers_insert_admin" on public.category_approvers;
drop policy "category_approvers_update_admin" on public.category_approvers;
drop policy "category_approvers_delete_admin" on public.category_approvers;

create policy "category_approvers_select_admin"
  on public.category_approvers for select
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
  );

create policy "category_approvers_insert_admin"
  on public.category_approvers for insert
  to authenticated
  with check (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
  );

create policy "category_approvers_update_admin"
  on public.category_approvers for update
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
  )
  with check (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
  );

create policy "category_approvers_delete_admin"
  on public.category_approvers for delete
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
  );

-- invitations
drop policy "Admins manage invitations" on public.invitations;

create policy "Admins manage invitations"
  on public.invitations for all
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
  )
  with check (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
  );

-- notifications
drop policy "Users can read their own notifications" on public.notifications;
drop policy "Users can update their own notifications" on public.notifications;
drop policy "Users can delete their own notifications" on public.notifications;

create policy "Users can read their own notifications"
  on public.notifications for select
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and user_id = auth.uid()
  );

create policy "Users can update their own notifications"
  on public.notifications for update
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and user_id = auth.uid()
  )
  with check (
    organization_id = (select public.current_org_id())
    and user_id = auth.uid()
  );

create policy "Users can delete their own notifications"
  on public.notifications for delete
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and user_id = auth.uid()
  );

-- recurring_work_orders
drop policy "Authenticated users can read recurring work orders" on public.recurring_work_orders;
drop policy "Filers can insert recurring work orders" on public.recurring_work_orders;
drop policy "Editors can update recurring work orders" on public.recurring_work_orders;
drop policy "Editors can delete recurring work orders" on public.recurring_work_orders;

create policy "Authenticated users can read recurring work orders"
  on public.recurring_work_orders for select
  to authenticated
  using (organization_id = (select public.current_org_id()));

create policy "Filers can insert recurring work orders"
  on public.recurring_work_orders for insert
  to authenticated
  with check (
    organization_id = (select public.current_org_id())
    and public.current_user_role() in ('administrator', 'requester')
    and created_by = auth.uid()
    and updated_by = auth.uid()
  );

create policy "Editors can update recurring work orders"
  on public.recurring_work_orders for update
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and (
      public.current_user_role() = 'administrator'
      or (public.current_user_role() = 'requester' and created_by = auth.uid())
    )
  )
  with check (
    organization_id = (select public.current_org_id())
    and (
      public.current_user_role() = 'administrator'
      or (public.current_user_role() = 'requester' and created_by = auth.uid())
    )
  );

create policy "Editors can delete recurring work orders"
  on public.recurring_work_orders for delete
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and (
      public.current_user_role() = 'administrator'
      or (public.current_user_role() = 'requester' and created_by = auth.uid())
    )
  );

-- user_roles ("Users can read their own role" and the auth hook policy need
-- no organization check and stay as they are)
drop policy "Admins can read all roles" on public.user_roles;
drop policy "Admins can insert roles" on public.user_roles;
drop policy "Admins can update non-admin roles" on public.user_roles;
drop policy "Admins can delete roles" on public.user_roles;

create policy "Admins can read all roles"
  on public.user_roles for select
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
  );

create policy "Admins can insert roles"
  on public.user_roles for insert
  to authenticated
  with check (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
  );

create policy "Admins can update non-admin roles"
  on public.user_roles for update
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
    and user_id <> auth.uid()
    and role <> 'administrator'
  )
  with check (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
    and user_id <> auth.uid()
  );

create policy "Admins can delete roles"
  on public.user_roles for delete
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
  );

-- work_order_activity
drop policy "Authenticated users can read work order activity" on public.work_order_activity;

create policy "Authenticated users can read work order activity"
  on public.work_order_activity for select
  to authenticated
  using (organization_id = (select public.current_org_id()));

-- work_order_attachments
drop policy "Authenticated users can read work order attachments" on public.work_order_attachments;
drop policy "Workers can add work order attachments" on public.work_order_attachments;
drop policy "Workers can delete work order attachments" on public.work_order_attachments;

create policy "Authenticated users can read work order attachments"
  on public.work_order_attachments for select
  to authenticated
  using (organization_id = (select public.current_org_id()));

create policy "Workers can add work order attachments"
  on public.work_order_attachments for insert
  to authenticated
  with check (
    organization_id = (select public.current_org_id())
    and uploaded_by = auth.uid()
    and exists (
      select 1
      from public.work_orders wo
      where wo.id = work_order_attachments.work_order_id
        and (
          public.current_user_role() = 'administrator'
          or wo.created_by = auth.uid()
          or wo.assigned_to = auth.uid()
        )
    )
  );

create policy "Workers can delete work order attachments"
  on public.work_order_attachments for delete
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and exists (
      select 1
      from public.work_orders wo
      where wo.id = work_order_attachments.work_order_id
        and (
          public.current_user_role() = 'administrator'
          or wo.created_by = auth.uid()
          or wo.assigned_to = auth.uid()
        )
    )
  );

-- work_order_notes
drop policy "Authenticated users can read work order notes" on public.work_order_notes;
drop policy "Authenticated users can add work order notes" on public.work_order_notes;
drop policy "Authors can update their work order notes" on public.work_order_notes;
drop policy "Authors or admins can delete work order notes" on public.work_order_notes;

create policy "Authenticated users can read work order notes"
  on public.work_order_notes for select
  to authenticated
  using (organization_id = (select public.current_org_id()));

create policy "Authenticated users can add work order notes"
  on public.work_order_notes for insert
  to authenticated
  with check (
    organization_id = (select public.current_org_id())
    and created_by = auth.uid()
  );

create policy "Authors can update their work order notes"
  on public.work_order_notes for update
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and created_by = auth.uid()
  )
  with check (
    organization_id = (select public.current_org_id())
    and created_by = auth.uid()
  );

create policy "Authors or admins can delete work order notes"
  on public.work_order_notes for delete
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and (created_by = auth.uid() or public.current_user_role() = 'administrator')
  );

-- work_orders
drop policy "Authenticated users can read work orders" on public.work_orders;
drop policy "Filers can insert work orders" on public.work_orders;
drop policy "Editors can update work orders" on public.work_orders;
drop policy "Assignees and creators can change status" on public.work_orders;

create policy "Authenticated users can read work orders"
  on public.work_orders for select
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and (
      public.current_user_role() = 'administrator'
      or status not in ('pending', 'rejected')
      or created_by = auth.uid()
    )
  );

create policy "Filers can insert work orders"
  on public.work_orders for insert
  to authenticated
  with check (
    organization_id = (select public.current_org_id())
    and public.current_user_role() in ('administrator', 'requester')
    and created_by = auth.uid()
    and updated_by = auth.uid()
    and resolution is null
    and (
      (public.current_user_role() = 'administrator' and status = 'open')
      or (public.current_user_role() = 'requester' and status = 'pending')
    )
  );

create policy "Editors can update work orders"
  on public.work_orders for update
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and (
      public.current_user_role() = 'administrator'
      or (
        public.current_user_role() = 'requester'
        and (created_by = auth.uid() or assigned_to = auth.uid())
      )
    )
  )
  with check (
    organization_id = (select public.current_org_id())
    and updated_by = auth.uid()
    and (
      public.current_user_role() = 'administrator'
      or (
        public.current_user_role() = 'requester'
        and (created_by = auth.uid() or assigned_to = auth.uid())
      )
    )
  );

create policy "Assignees and creators can change status"
  on public.work_orders for update
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and (auth.uid() = assigned_to or auth.uid() = created_by)
    and status in ('open', 'in_progress', 'on_hold', 'done', 'closed')
  )
  with check (
    organization_id = (select public.current_org_id())
    and updated_by = auth.uid()
    and (auth.uid() = assigned_to or auth.uid() = created_by)
    and status in ('open', 'in_progress', 'on_hold', 'done', 'closed')
  );


-- ── SECURITY DEFINER functions that read tenant data ───────────────────────

-- Adds the org_id claim beside user_role.
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
  org_id    uuid;
begin
  select ur.role, ur.organization_id into user_role, org_id
  from public.user_roles ur
  where ur.user_id = (event->>'user_id')::uuid;

  if user_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role::text));
    claims := jsonb_set(claims, '{org_id}', to_jsonb(org_id::text));
  else
    claims := claims - 'user_role' - 'org_id';
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Invited users join the inviting organization. Everyone else joins the
-- organization that registered their email domain, or is refused.
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
  select * into invite
  from public.invitations
  where lower(email) = lower(new.email)
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  order by created_at desc
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
    where o.allowed_email_domain = lower(split_part(new.email, '@', 2));

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
  inner join public.user_roles ur on ur.user_id = u.id
  where public.current_user_role() = 'administrator'
    and ur.organization_id = public.current_org_id()
  order by u.created_at desc;
$$;

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
  where ur.organization_id = public.current_org_id()
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

create or replace function public.get_category_approvers(
  p_category public.work_order_category
)
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
    ca.user_id,
    u.email,
    (u.raw_user_meta_data ->> 'first_name'),
    (u.raw_user_meta_data ->> 'last_name')
  from public.category_approvers ca
  inner join auth.users u on u.id = ca.user_id
  inner join public.user_roles ur
    on ur.user_id = ca.user_id
   and ur.organization_id = ca.organization_id
  where ca.category = p_category
    and ca.organization_id = public.current_org_id()
    and ur.role = 'administrator';
$$;

-- Runs from pg_cron with no signed-in user, so current_org_id() is null here.
-- Generated work orders take the organization of the schedule.
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
    select *
    from public.recurring_work_orders
    where active
      and next_due_at is not null
      and next_due_at <= now() + make_interval(days => generation_lead_days)
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

-- organization_id never changes after insert, so leave it out of the
-- activity log's change detection like the other bookkeeping columns.
create or replace function public.log_work_order_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old     jsonb;
  v_new     jsonb;
  v_key     text;
  v_changes jsonb := '{}'::jsonb;
  v_ignored text[] := array[
    'id', 'created_at', 'created_by', 'updated_at', 'updated_by',
    'work_order_code', 'search_text', 'closed_at', 'organization_id'
  ];
begin
  if tg_op = 'INSERT' then
    insert into public.work_order_activity (work_order_id, actor_id, action, details)
    values (new.id, new.created_by, 'created', '{}'::jsonb);
    return new;
  end if;

  v_old := to_jsonb(old);
  v_new := to_jsonb(new);

  for v_key in select jsonb_object_keys(v_new) loop
    if v_key = any(v_ignored) then
      continue;
    end if;
    if v_old -> v_key is distinct from v_new -> v_key then
      v_changes := v_changes || jsonb_build_object(
        v_key,
        jsonb_build_object('from', v_old -> v_key, 'to', v_new -> v_key)
      );
    end if;
  end loop;

  -- Skip no-op updates (only audit columns changed).
  if v_changes <> '{}'::jsonb then
    insert into public.work_order_activity (work_order_id, actor_id, action, details)
    values (
      new.id,
      coalesce(new.updated_by, auth.uid()),
      'updated',
      jsonb_build_object('changes', v_changes)
    );
  end if;

  return new;
end;
$$;


-- ── lock down function execution ───────────────────────────────────────────
-- Production already restricts these through earlier revoke statements.
-- Supabase's local image also grants EXECUTE to anon and authenticated by
-- default, so repeat the restriction here to keep local tests faithful.

revoke execute on function public.generate_due_recurring_work_orders() from anon, authenticated;
revoke execute on function public.recurring_work_orders_due_for_reminder() from anon, authenticated;
revoke execute on function public.record_reminder_sent(uuid, integer) from anon, authenticated;
revoke execute on function public.trigger_recurrence_reminders() from anon, authenticated;
revoke execute on function public.admin_list_users() from anon;
revoke execute on function public.list_assignable_users() from anon;
revoke execute on function public.get_category_approvers(public.work_order_category) from anon;
revoke execute on function public.current_user_role() from anon;
