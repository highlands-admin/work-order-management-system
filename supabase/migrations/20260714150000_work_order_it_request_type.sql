-- Type of Request for IT work orders: the condensed IT ticket sub-category,
-- populated only for the 'it' category (mirrors marketing_request_type).
--
-- Stored as nullable text, validated in the app (required for the 'it' category
-- on create and edit). Unlike marketing, no CHECK constraint is added: there is
-- no catch-all 'other' value to backfill legacy IT rows with, and a CHECK would
-- be re-evaluated on every future update to those rows. App-level validation
-- keeps new and edited IT work orders categorized without breaking imports.

alter table public.work_orders
  add column if not exists it_request_type text;
