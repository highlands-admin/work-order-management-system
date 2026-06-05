-- Assignee is optional at creation: a work order may be filed without being
-- assigned to anyone yet. Make assigned_to nullable. The foreign key and its
-- on-delete restrict behavior still apply to non-null values.

alter table public.work_orders
  alter column assigned_to drop not null;
