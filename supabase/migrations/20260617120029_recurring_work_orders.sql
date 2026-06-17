-- Recurring work orders: templates that materialize into ordinary work orders on
-- a schedule. Each row is a rule ("Fire Alarm inspection, annual, Cartersville,
-- provider Comsec") that a daily pg_cron job turns into a concrete work order in
-- public.work_orders as each occurrence comes due. Generated occurrences are
-- normal work orders, so the existing list, dashboard, RLS, and activity log keep
-- working unchanged. These templates are shown in their own table in the UI,
-- separate from the main work orders table.

create table public.recurring_work_orders (
  id                   uuid primary key default gen_random_uuid(),
  -- Core work order fields, mirrored so a generated occurrence can be built
  -- entirely from the template.
  title                text not null,
  category             public.work_order_category not null,
  priority             public.work_order_priority not null,
  -- property follows the same rule as work_orders: required for every category
  -- except IT, which spans systems rather than a physical site.
  property             public.property,
  unit_number          text,
  description          text not null,
  -- The vendor or department that performs the inspection (for example
  -- "Cartersville Sprinkler" or "Environmental / Health dept"). Optional.
  provider             text,
  -- Default assignee for each generated occurrence. Optional, matching the
  -- assigned_to-optional change on work_orders.
  assigned_to          uuid references auth.users(id) on delete set null,

  -- Recurrence rule.
  frequency            public.recurrence_frequency not null,
  recurrence_interval  integer not null default 1,
  -- First occurrence date. Kept for reference; next_due_at drives generation.
  anchor_date          date not null,
  -- Due date of the next occurrence to generate. Null once a one_time template
  -- has fired or a series is closed.
  next_due_at          timestamptz,

  -- Reminders.
  -- How many days before an occurrence's due date to email a reminder.
  reminder_lead_days   integer not null default 14,
  -- How many days before an occurrence's due date to materialize the work order,
  -- so there is lead time to schedule the vendor. Must be at least the reminder
  -- lead so the work order exists by the time the reminder fires.
  generation_lead_days integer not null default 30,

  active               boolean not null default true,
  created_by           uuid not null references auth.users(id) on delete restrict,
  updated_by           uuid not null references auth.users(id) on delete restrict,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint recurring_work_orders_property_required_for_non_it
    check (category = 'it' or property is not null),
  constraint recurring_work_orders_interval_positive
    check (recurrence_interval >= 1),
  constraint recurring_work_orders_reminder_lead_nonneg
    check (reminder_lead_days >= 0),
  constraint recurring_work_orders_generation_covers_reminder
    check (generation_lead_days >= reminder_lead_days),
  constraint recurring_work_orders_title_not_empty
    check (length(trim(title)) > 0)
);

-- The generation job scans for active templates whose next occurrence is within
-- the generation window, so index exactly that working set.
create index recurring_work_orders_due_idx
  on public.recurring_work_orders (next_due_at)
  where active and next_due_at is not null;

create trigger recurring_work_orders_set_updated_at
  before update on public.recurring_work_orders
  for each row execute function public.set_updated_at();

alter table public.recurring_work_orders enable row level security;

-- Read: every authenticated user can see the recurring schedule, matching the
-- "all authenticated users can read work orders" policy.
create policy "Authenticated users can read recurring work orders"
  on public.recurring_work_orders
  for select
  to authenticated
  using (true);

-- Insert / update / delete: administrators and requesters manage the schedule.
-- The new row's created_by must equal the caller, mirroring the work_orders
-- insert policy.
create policy "Filers can insert recurring work orders"
  on public.recurring_work_orders
  for insert
  to authenticated
  with check (
    public.current_user_role() in ('administrator', 'requester')
    and created_by = auth.uid()
    and updated_by = auth.uid()
  );

create policy "Filers can update recurring work orders"
  on public.recurring_work_orders
  for update
  to authenticated
  using (public.current_user_role() in ('administrator', 'requester'))
  with check (public.current_user_role() in ('administrator', 'requester'));

create policy "Filers can delete recurring work orders"
  on public.recurring_work_orders
  for delete
  to authenticated
  using (public.current_user_role() in ('administrator', 'requester'));

-- "Automatically expose new tables" is disabled, so grant the Data API role
-- access explicitly; RLS still governs every row (see 20260513120006).
grant select, insert, update, delete on public.recurring_work_orders to authenticated;
