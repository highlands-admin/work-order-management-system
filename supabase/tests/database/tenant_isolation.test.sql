-- Tenant isolation tests. Run with: npx supabase test db
--
-- Builds two organizations with their own users and data, then acts as each
-- user under RLS to check that nothing crosses the boundary. Covers direct
-- table reads, SECURITY DEFINER RPCs, cross-organization writes, the
-- trigger-created rows (activity and notifications), signup routing, and the
-- recurring work order cron job. Everything runs in one transaction and rolls
-- back.

begin;

select no_plan();

-- ── helpers ────────────────────────────────────────────────────────────────

-- Switches to the authenticated role with claims matching what the access
-- token hook issues for the user. Pass false to omit org_id and simulate a
-- token issued before the multi-tenant migration.
create function pg_temp.act_as(p_user uuid, p_include_org boolean default true)
returns void
language plpgsql
as $$
declare
  v_role   text;
  v_org    uuid;
  v_claims jsonb;
begin
  perform set_config('role', 'postgres', true);

  select ur.role::text, ur.organization_id into v_role, v_org
  from public.user_roles ur
  where ur.user_id = p_user;

  v_claims := jsonb_build_object(
    'sub', p_user,
    'role', 'authenticated',
    'user_role', v_role
  );
  if p_include_org then
    v_claims := v_claims || jsonb_build_object('org_id', v_org);
  end if;

  perform set_config('request.jwt.claims', v_claims::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.act_as_postgres()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

grant execute on all functions in schema pg_temp to authenticated;

-- ── fixtures ───────────────────────────────────────────────────────────────
-- Org A is the Highlands organization created by the migration. Org B is new.
-- handle_new_user places each user by email domain, which doubles as a test
-- of signup routing.

insert into public.organizations (id, name, slug, allowed_email_domain)
values ('bbbbbbbb-0000-0000-0000-000000000000', 'Org B', 'org-b', 'orgb.test');

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a.admin@highlands.care', '{"first_name":"Ann"}'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'a.tech@highlands.care',  '{"first_name":"Abe"}'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'b.admin@orgb.test',      '{"first_name":"Bea"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b.req@orgb.test',        '{"first_name":"Bo"}');

update public.user_roles set role = 'administrator'
  where user_id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001');
update public.user_roles set role = 'technician'
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000002';

select is(
  (select count(*)::int from public.user_roles ur
     join public.organizations o on o.id = ur.organization_id
    where o.slug = 'highlands'
      and ur.user_id in ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002')),
  2,
  'signup by domain places highlands.care users in Highlands'
);

select is(
  (select count(*)::int from public.user_roles
    where organization_id = 'bbbbbbbb-0000-0000-0000-000000000000'),
  2,
  'signup by domain places orgb.test users in Org B'
);

select throws_ok(
  $$ insert into auth.users (id, email) values (gen_random_uuid(), 'stranger@unknown.test') $$,
  '23514',
  null,
  'signup from an unregistered domain without an invitation is refused'
);

-- Org A data, created through RLS as the Org A administrator.
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');

insert into public.work_orders
  (id, title, category, priority, description, status, assigned_to, created_by, updated_by)
values
  ('aaaaaaaa-1111-0000-0000-000000000001', 'A printer', 'it', 'medium', 'Jammed', 'open',
   'aaaaaaaa-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');

insert into public.work_order_notes (work_order_id, created_by, body)
values ('aaaaaaaa-1111-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'A note');

insert into public.work_order_attachments
  (work_order_id, object_key, content_type, size_bytes, uploaded_by)
values
  ('aaaaaaaa-1111-0000-0000-000000000001',
   'work-orders/' || public.current_org_id() || '/photo.jpg', 'image/jpeg', 100,
   'aaaaaaaa-0000-0000-0000-000000000001');

insert into public.invitations (email, role, invited_by, token, expires_at)
values ('new.hire@highlands.care', 'technician', 'aaaaaaaa-0000-0000-0000-000000000001',
        'token-a', now() + interval '7 days');

insert into public.category_approvers (category, user_id)
values ('it', 'aaaaaaaa-0000-0000-0000-000000000001');

insert into public.recurring_work_orders
  (id, title, category, priority, description, frequency, anchor_date, next_due_at,
   created_by, updated_by)
values
  ('aaaaaaaa-2222-0000-0000-000000000001', 'A backups', 'it', 'low', 'Check backups',
   'monthly', current_date, now(),
   'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');

select throws_ok(
  $$ insert into public.work_order_attachments
       (work_order_id, object_key, content_type, size_bytes, uploaded_by)
     values ('aaaaaaaa-1111-0000-0000-000000000001',
             'work-orders/bbbbbbbb-0000-0000-0000-000000000000/stolen.jpg',
             'image/jpeg', 1, 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '42501',
  'Attachment key does not belong to this organization',
  'an attachment key under another organization''s prefix is refused'
);

select throws_ok(
  $$ insert into public.work_order_attachments
       (work_order_id, object_key, content_type, size_bytes, uploaded_by)
     values ('aaaaaaaa-1111-0000-0000-000000000001',
             'work-orders/legacy-style.jpg',
             'image/jpeg', 1, 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '42501',
  'Attachment key does not belong to this organization',
  'new attachments must use an organization-prefixed key'
);

-- Org B data.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');

insert into public.work_orders
  (id, title, category, priority, description, status, created_by, updated_by)
values
  ('bbbbbbbb-1111-0000-0000-000000000001', 'B router', 'it', 'high', 'Down', 'open',
   'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001');

-- ── rows stamped by triggers ───────────────────────────────────────────────

select pg_temp.act_as_postgres();

select is(
  (select array_agg(distinct organization_id) from public.work_order_activity
    where work_order_id = 'aaaaaaaa-1111-0000-0000-000000000001'),
  array[(select id from public.organizations where slug = 'highlands')],
  'activity rows inherit the work order organization'
);

select is(
  (select organization_id from public.notifications
    where user_id = 'aaaaaaaa-0000-0000-0000-000000000002' and type = 'assigned'),
  (select id from public.organizations where slug = 'highlands'),
  'assignment notification carries the recipient organization'
);

-- ── Org B cannot read Org A ────────────────────────────────────────────────

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');

select is((select count(*)::int from public.work_orders), 1,
  'work_orders: Org B admin sees only its own work order');
select is((select count(*)::int from public.work_order_notes), 0,
  'work_order_notes: Org B sees no Org A notes');
select is((select count(*)::int from public.work_order_attachments), 0,
  'work_order_attachments: Org B sees no Org A attachments');
select is((select count(*)::int from public.work_order_activity
            where organization_id <> 'bbbbbbbb-0000-0000-0000-000000000000'), 0,
  'work_order_activity: Org B sees no Org A activity');
select is((select count(*)::int from public.recurring_work_orders), 0,
  'recurring_work_orders: Org B sees no Org A schedules');
select is((select count(*)::int from public.invitations), 0,
  'invitations: Org B sees no Org A invitations');
select is((select count(*)::int from public.category_approvers), 0,
  'category_approvers: Org B sees no Org A approvers');
select is((select count(*)::int from public.notifications), 0,
  'notifications: Org B sees no Org A notifications');
select is((select count(*)::int from public.user_roles), 2,
  'user_roles: Org B admin sees only Org B roles');
select is((select count(*)::int from public.organizations), 1,
  'organizations: Org B sees only its own organization');

select is((select count(*)::int from public.admin_list_users()), 2,
  'admin_list_users returns only Org B users');
select is((select count(*)::int from public.list_assignable_users()), 2,
  'list_assignable_users returns only Org B users');
select is((select count(*)::int from public.get_category_approvers('it')), 0,
  'get_category_approvers returns no Org A approvers');

-- Tokens issued before the migration lack org_id and fall back to user_roles.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001', false);

select is((select count(*)::int from public.work_orders), 1,
  'a token without org_id still sees only its own organization');

-- ── Org B cannot write into Org A ──────────────────────────────────────────

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');

select throws_ok(
  $$ insert into public.work_orders
       (organization_id, title, category, priority, description, status, created_by, updated_by)
     values ((select id from public.organizations where slug = 'highlands'),
             'Planted', 'it', 'low', 'x', 'open',
             'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001') $$,
  '42501',
  null,
  'Org B cannot create a work order in Org A'
);

select throws_ok(
  $$ insert into public.work_order_notes (work_order_id, created_by, body)
     values ('aaaaaaaa-1111-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Hi') $$,
  '42501',
  null,
  'Org B cannot add a note to an Org A work order'
);

select throws_ok(
  $$ update public.work_orders
        set assigned_to = 'aaaaaaaa-0000-0000-0000-000000000002',
            updated_by = 'bbbbbbbb-0000-0000-0000-000000000001'
      where id = 'bbbbbbbb-1111-0000-0000-000000000001' $$,
  '42501',
  'Assignees and recipients must belong to the same organization',
  'Org B cannot assign its work order to an Org A user'
);

select throws_ok(
  $$ update public.work_orders
        set notify_recipients = array['aaaaaaaa-0000-0000-0000-000000000001'::uuid],
            updated_by = 'bbbbbbbb-0000-0000-0000-000000000001'
      where id = 'bbbbbbbb-1111-0000-0000-000000000001' $$,
  '42501',
  'Assignees and recipients must belong to the same organization',
  'Org B cannot add an Org A user as a notify recipient'
);

update public.work_orders
   set title = 'Hijacked', updated_by = 'bbbbbbbb-0000-0000-0000-000000000001'
 where id = 'aaaaaaaa-1111-0000-0000-000000000001';

select throws_ok(
  $$ insert into public.organizations (name, slug) values ('Rogue', 'rogue') $$,
  '42501',
  null,
  'an org administrator cannot create organizations'
);

select pg_temp.act_as_postgres();

select is(
  (select title from public.work_orders where id = 'aaaaaaaa-1111-0000-0000-000000000001'),
  'A printer',
  'Org B update against an Org A work order changes nothing'
);

-- ── function privileges ────────────────────────────────────────────────────

select ok(
  not has_function_privilege('anon', 'public.recurring_work_orders_due_for_reminder()', 'execute')
  and not has_function_privilege('authenticated', 'public.recurring_work_orders_due_for_reminder()', 'execute'),
  'the cross-organization reminder query is limited to service_role'
);

select ok(
  not has_function_privilege('authenticated', 'public.generate_due_recurring_work_orders()', 'execute'),
  'signed-in users cannot run the recurring work order generator'
);

-- ── super admin ────────────────────────────────────────────────────────────

insert into public.platform_admins (user_id)
values ('bbbbbbbb-0000-0000-0000-000000000002');

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');

select is((select count(*)::int from public.organizations), 1,
  'RLS shows a super admin only their own organization');
select is((select count(*)::int from public.platform_list_organizations()), 2,
  'platform_list_organizations shows a super admin every organization');
select is((select count(*)::int from public.platform_list_properties(
             (select id from public.organizations where slug = 'highlands'))),
  0,
  'platform_list_properties returns rows for the named organization only');

select lives_ok(
  $$ select public.platform_create_organization('Org C', 'org-c', 'OrgC.test') $$,
  'a super admin can create an organization'
);

select pg_temp.act_as_postgres();
select is(
  (select allowed_email_domain from public.organizations where slug = 'org-c'),
  'orgc.test',
  'the signup domain is stored lowercase'
);
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');

select lives_ok(
  $$ select public.platform_add_property(
       (select o.id from public.platform_list_organizations() o where o.slug = 'org-c'),
       'main', 'Main Campus') $$,
  'a super admin can add a property to another organization'
);
select lives_ok(
  $$ select public.platform_update_property(
       (select o.id from public.platform_list_organizations() o where o.slug = 'org-c'),
       'main', 'Main Campus East', null) $$,
  'a super admin can rename another organization''s property'
);
select lives_ok(
  $$ select public.platform_invite_admin(
       (select o.id from public.platform_list_organizations() o where o.slug = 'org-c'),
       'Boss@OrgC.test', 'Cy', null, 'token-c', now() + interval '7 days') $$,
  'a super admin can invite an organization''s first administrator'
);
select is(
  (select pending_admin_invites from public.platform_list_organizations() where slug = 'org-c'),
  1,
  'the overview counts the pending administrator invitation'
);
select is((select count(*)::int from public.invitations), 0,
  'the invitation is not visible to the super admin through RLS');

-- The invited administrator signs up and lands in Org C.
select pg_temp.act_as_postgres();
insert into auth.users (id, email)
values ('cccccccc-0000-0000-0000-000000000001', 'boss@orgc.test');
select is(
  (select ur.role::text || '@' || o.slug
     from public.user_roles ur join public.organizations o on o.id = ur.organization_id
    where ur.user_id = 'cccccccc-0000-0000-0000-000000000001'),
  'administrator@org-c',
  'the invited administrator joins the new organization as an administrator'
);

select pg_temp.act_as('cccccccc-0000-0000-0000-000000000001');
select is((select string_agg(name, ',') from public.properties), 'Main Campus East',
  'the new organization sees the property the super admin configured');

-- Everyone else is refused by the platform functions.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');
select throws_ok($$ select * from public.platform_list_organizations() $$, '42501', null,
  'an org administrator cannot list organizations');
select throws_ok($$ select public.platform_create_organization('X', 'x', null) $$, '42501', null,
  'an org administrator cannot create organizations');
select throws_ok(
  $$ select public.platform_add_property(
       (select id from public.organizations limit 1), 'x', 'X') $$,
  '42501', null,
  'an org administrator cannot use the platform property functions');

select pg_temp.act_as_postgres();
set local role anon;
select ok(public.signup_domain_allowed('someone@ORGB.test'),
  'signup_domain_allowed accepts a registered domain');
select ok(not public.signup_domain_allowed('someone@unknown.test'),
  'signup_domain_allowed rejects an unregistered domain');
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.work_orders
            where organization_id <> 'bbbbbbbb-0000-0000-0000-000000000000'), 0,
  'super admin status grants no access to other organizations'' work orders');

-- ── properties ─────────────────────────────────────────────────────────────
-- Platform admins manage properties through the platform functions. The Org B
-- requester (bbbbbbbb-...-0002) is the platform admin set up above.

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');

select is((select count(*)::int from public.properties), 0,
  'properties: Org B sees none of the Highlands properties');

select throws_ok(
  $$ insert into public.work_orders
       (title, category, priority, description, status, property, created_by, updated_by)
     values ('Leak', 'maintenance', 'high', 'x', 'open', 'norcross',
             'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001') $$,
  null,
  null,
  'Org B cannot use a property key that only Highlands has'
);

select throws_ok(
  $$ insert into public.properties (key, name) values ('annex', 'Annex') $$,
  '42501',
  null,
  'an org administrator cannot add properties directly'
);

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.platform_add_property(
  'bbbbbbbb-0000-0000-0000-000000000000', 'norcross', 'Norcross Annex');

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');

select lives_ok(
  $$ insert into public.work_orders
       (title, category, priority, description, status, property, created_by, updated_by)
     values ('Leak', 'maintenance', 'high', 'x', 'open', 'norcross',
             'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001') $$,
  'Org B can reuse a key once a platform admin adds its own property'
);

select throws_ok(
  $$ update public.properties set name = 'Renamed' where key = 'norcross' $$,
  '42501',
  null,
  'an org administrator cannot rename properties directly'
);

select throws_ok(
  $$ delete from public.properties where key = 'norcross' $$,
  '42501',
  null,
  'properties cannot be deleted, only retired'
);

select pg_temp.act_as_postgres();
select throws_ok(
  $$ update public.properties set key = 'renamed' where key = 'norcross' $$,
  '42501',
  null,
  'a property key cannot change'
);

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.platform_update_property(
  'bbbbbbbb-0000-0000-0000-000000000000', 'norcross', null, false);

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');

select throws_ok(
  $$ insert into public.work_orders
       (title, category, priority, description, status, property, created_by, updated_by)
     values ('Drip', 'maintenance', 'low', 'x', 'open', 'norcross',
             'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001') $$,
  '23514',
  null,
  'new work orders cannot use a retired property'
);

select lives_ok(
  $$ update public.work_orders
        set title = 'Leak (retitled)', updated_by = 'bbbbbbbb-0000-0000-0000-000000000001'
      where property = 'norcross' $$,
  'work orders already on a retired property can still be edited'
);

select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');

select is(
  (select name from public.properties where key = 'norcross'),
  'Norcross',
  'the Highlands property is unaffected by the Org B property with the same key'
);

-- ── invitations and existing accounts ─────────────────────────────────────

select pg_temp.act_as_postgres();
insert into public.invitations
  (organization_id, email, role, invited_by, token, expires_at)
values
  ('bbbbbbbb-0000-0000-0000-000000000000', 'A.Tech@highlands.care', 'technician',
   'bbbbbbbb-0000-0000-0000-000000000001', 'token-existing', now() + interval '1 day'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'fresh@elsewhere.test', 'technician',
   'bbbbbbbb-0000-0000-0000-000000000001', 'token-fresh', now() + interval '1 day');

set local role anon;
select is(
  (select organization_name || ':' || account_exists from public.invitation_by_token('token-existing')),
  'Org B:true',
  'invitation_by_token names the organization and flags an existing account'
);
select is(
  (select account_exists from public.invitation_by_token('token-fresh')),
  false,
  'invitation_by_token reports no account for a new email'
);
select throws_ok($$ select public.platform_email_has_account('a.tech@highlands.care') $$,
  '42501', null, 'anonymous visitors cannot check whether an email has an account');

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');
select throws_ok($$ select public.platform_email_has_account('a.tech@highlands.care') $$,
  '42501', null, 'org administrators cannot check accounts outside their organization');

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select ok(public.platform_email_has_account(' A.Tech@Highlands.care '),
  'platform admins can check whether an email has an account');

-- ── cron job ───────────────────────────────────────────────────────────────

select pg_temp.act_as_postgres();

select ok(public.generate_due_recurring_work_orders() >= 1,
  'the recurring generator creates due work orders');

select is(
  (select organization_id from public.work_orders
    where recurring_work_order_id = 'aaaaaaaa-2222-0000-0000-000000000001'),
  (select id from public.organizations where slug = 'highlands'),
  'generated work orders take the schedule organization'
);

select * from finish();

rollback;
