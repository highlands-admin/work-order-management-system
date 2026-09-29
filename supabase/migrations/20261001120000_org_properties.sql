-- ---------------------------------------------------------------------------
-- Per-organization properties
--
-- Replaces the public.property enum with a properties table that each
-- organization manages. work_orders.property and recurring_work_orders.property
-- become text keys (the former enum values, so existing rows, filter URLs, and
-- activity history stay valid) and reference properties through a composite
-- foreign key on (organization_id, property). That key also guarantees a work
-- order can only use a property from its own organization.
--
-- The key is stable and never shown to users. Renaming a property changes only
-- its name. Properties are retired with is_active instead of deleted, because
-- existing work orders keep pointing at them.
--
-- Rollback outline:
--   create type public.property as enum (...keys in use...);
--   drop the foreign keys and the active-property triggers;
--   alter both columns back with "using property::public.property";
--   restore recurring_work_orders_due_for_reminder from
--   20260618120034_recurring_multiple_reminders.sql;
--   drop table public.properties;
-- ---------------------------------------------------------------------------


-- ── properties ─────────────────────────────────────────────────────────────

create table public.properties (
  organization_id uuid        not null default public.current_org_id()
                                references public.organizations(id) on delete restrict,
  key             text        not null check (key ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  name            text        not null check (length(trim(name)) > 0),
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (organization_id, key)
);

-- Two properties in one organization cannot share a display name.
create unique index properties_organization_name_key
  on public.properties (organization_id, lower(name));

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- The key is referenced by work orders, so it can never change.
create or replace function public.enforce_property_key_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.key is distinct from old.key
     or new.organization_id is distinct from old.organization_id then
    raise exception 'A property key and organization cannot change'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_property_key_immutable() from public, anon, authenticated;

create trigger properties_enforce_key_immutable
  before update on public.properties
  for each row execute function public.enforce_property_key_immutable();

alter table public.properties enable row level security;

create policy "Members read their organization's properties"
  on public.properties for select
  to authenticated
  using (organization_id = (select public.current_org_id()));

create policy "Admins add properties"
  on public.properties for insert
  to authenticated
  with check (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
  );

create policy "Admins update properties"
  on public.properties for update
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
  )
  with check (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
  );

-- No delete policy: retire a property with is_active instead.

grant select, insert, update on public.properties to authenticated;


-- ── seed the existing organization ─────────────────────────────────────────

insert into public.properties (organization_id, key, name)
select o.id, p.key, p.name
from public.organizations o
cross join (values
  ('norcross',     'Norcross'),
  ('jefferson',    'Jefferson'),
  ('rome',         'Rome'),
  ('gaston',       'Gaston'),
  ('cartersville', 'Cartersville'),
  ('columbia',     'Columbia'),
  ('forest_city',  'Forest City'),
  ('clinton',      'Clinton'),
  ('corporate',    'Corporate')
) as p(key, name)
where o.slug = 'highlands';


-- ── convert the enum columns to keys ───────────────────────────────────────

-- The reminder query's return type names the enum, so it must go before the
-- enum can be dropped. It is recreated below.
drop function public.recurring_work_orders_due_for_reminder();

-- Changing a column type rewrites the table, which fires no row triggers, so
-- updated_at and the activity log are untouched.
alter table public.work_orders
  alter column property type text using property::text;
alter table public.recurring_work_orders
  alter column property type text using property::text;

drop type public.property;

alter table public.work_orders
  add constraint work_orders_property_fkey
  foreign key (organization_id, property)
  references public.properties (organization_id, key)
  on delete restrict;

alter table public.recurring_work_orders
  add constraint recurring_work_orders_property_fkey
  foreign key (organization_id, property)
  references public.properties (organization_id, key)
  on delete restrict;

create index recurring_work_orders_property_idx
  on public.recurring_work_orders (organization_id, property);


-- ── retired properties ─────────────────────────────────────────────────────
-- New work orders and edits that change the property must pick an active one.
-- Rows that already point at a retired property keep it. The recurring
-- generator runs without a signed-in user and is exempt, so retiring a
-- property never breaks existing schedules.
create or replace function public.enforce_active_property()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or new.property is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.property is not distinct from old.property then
    return new;
  end if;

  if not exists (
    select 1
    from public.properties p
    where p.organization_id = new.organization_id
      and p.key = new.property
      and p.is_active
  ) then
    raise exception 'Property % is not available', new.property
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_active_property() from public, anon, authenticated;

create trigger work_orders_enforce_active_property
  before insert or update on public.work_orders
  for each row execute function public.enforce_active_property();

create trigger recurring_work_orders_enforce_active_property
  before insert or update on public.recurring_work_orders
  for each row execute function public.enforce_active_property();


-- ── reminder query ─────────────────────────────────────────────────────────
-- Same as before, with property as text and the property's display name
-- added. The cron route calls this with the service role, which has no table
-- grants, so the name must come back from the function.
create function public.recurring_work_orders_due_for_reminder()
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
    and now() < w.due_at + interval '1 day'
$$;

revoke all on function public.recurring_work_orders_due_for_reminder() from public, anon, authenticated;
grant execute on function public.recurring_work_orders_due_for_reminder() to service_role;
