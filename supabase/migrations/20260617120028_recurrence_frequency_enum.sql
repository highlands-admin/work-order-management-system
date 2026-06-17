-- Recurrence cadence for recurring work orders (inspections and licenses).
-- Modeled as an enum so the cadence is constrained at the database boundary,
-- matching the existing work_order_category and work_order_status enums.
--
--   one_time:   generate a single occurrence, then deactivate the template.
--   weekly:     repeat every recurrence_interval weeks.
--   monthly:    repeat every recurrence_interval months.
--   quarterly:  repeat every recurrence_interval * 3 months.
--   semiannual: repeat every recurrence_interval * 6 months.
--   annual:     repeat every recurrence_interval years.
create type public.recurrence_frequency as enum (
  'one_time',
  'weekly',
  'monthly',
  'quarterly',
  'semiannual',
  'annual'
);
