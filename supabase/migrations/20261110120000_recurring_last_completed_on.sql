-- When a recurring schedule was last completed before it was tracked in the
-- app. The State Compliance page shows each inspection's or license's last
-- completion date; once a schedule has closed work orders, the latest closure
-- wins, and this column only covers history from before Workflow 360 (for
-- example, the dates imported from a community's compliance spreadsheet).
--
-- Rollback:
--   alter table public.recurring_work_orders drop column if exists last_completed_on;

alter table public.recurring_work_orders
  add column if not exists last_completed_on date;

comment on column public.recurring_work_orders.last_completed_on is
  'Last completion recorded before the schedule was tracked in the app. Closed occurrences take precedence.';
