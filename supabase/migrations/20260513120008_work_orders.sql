-- Work orders: the core operational record of the system.
-- Categories, statuses, priorities, and properties are modeled as enums so the
-- domain is constrained at the database boundary, not just in application code.

create type public.work_order_category as enum (
  'maintenance',
  'it',
  'marketing'
);

create type public.work_order_status as enum (
  'open',
  'assigned',
  'in_progress',
  'done',
  'closed'
);

create type public.work_order_priority as enum (
  'urgent',
  'high',
  'medium',
  'low'
);

create type public.property as enum (
  'norcross',
  'jefferson',
  'rome',
  'gaston',
  'cartersville',
  'columbia',
  'forest_city'
);

create table public.work_orders (
  id                 uuid primary key default gen_random_uuid(),
  category           public.work_order_category not null,
  status             public.work_order_status   not null default 'open',
  property           public.property            not null,
  unit_number        text,
  priority           public.work_order_priority not null,
  due_at             timestamptz,
  description        text not null,
  resolution         text,
  reported_by_name   text,
  reported_by_email  text,
  reported_by_phone  text,
  created_by         uuid not null references auth.users(id) on delete restrict,
  updated_by         uuid not null references auth.users(id) on delete restrict,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- List newest first, scope by status, find tickets by property, and surface upcoming due dates.
create index work_orders_created_at_idx on public.work_orders (created_at desc);
create index work_orders_status_idx     on public.work_orders (status, created_at desc);
create index work_orders_property_idx   on public.work_orders (property, status);
create index work_orders_due_at_idx     on public.work_orders (due_at) where due_at is not null;

create trigger work_orders_set_updated_at
  before update on public.work_orders
  for each row execute function public.set_updated_at();

alter table public.work_orders enable row level security;

-- Read: every authenticated user can see every work order.
create policy "Authenticated users can read work orders"
  on public.work_orders
  for select
  to authenticated
  using (true);

-- Insert: only administrators, supervisors, and requesters. The new row's
-- created_by must equal the caller, status must start at 'open', and resolution
-- must be empty at creation time.
create policy "Filers can insert work orders"
  on public.work_orders
  for insert
  to authenticated
  with check (
    public.current_user_role() in ('administrator', 'supervisor', 'requester')
    and created_by = auth.uid()
    and updated_by = auth.uid()
    and status     = 'open'
    and resolution is null
  );

-- UPDATE and DELETE policies are intentionally omitted; RLS denies by default.
-- They will be added alongside the edit/close flows.

grant select, insert, update, delete on public.work_orders to authenticated;
