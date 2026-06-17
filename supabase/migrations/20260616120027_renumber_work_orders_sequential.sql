-- One-time data cleanup: renumber existing work orders so the identifiers are
-- contiguous in creation order, with the earliest work order at WO-1001. Gaps
-- had accumulated from deleted rows and rolled-back inserts, since the sequence
-- never reuses a number. work_order_code is a generated column derived from
-- work_order_number, so it updates automatically.
--
-- This rewrites every existing identifier. Only safe before the codes are
-- referenced externally (emails, exports, links). Do not re-run after that.

-- Disable all user-defined triggers on work_orders for the renumber. This is a
-- system data operation, not a user edit, so we bypass:
--   * work_orders_enforce_update_columns      (blocks writing work_order_number)
--   * work_orders_enforce_approval_transitions (blocks editing pending/rejected
--                                               rows from a role-less context)
--   * work_orders_set_updated_at              (so updated_at is left untouched)
--   * work_orders_log_activity                (so the feed is not flooded)
-- Internal foreign-key triggers stay active.
alter table public.work_orders disable trigger user;

-- Shift every number out of the target range first. Renumbering straight into
-- the 1001+ range in a single statement could otherwise trip the unique index
-- when a row's new value equals one another (not-yet-updated) row still holds.
-- The current numbers are far below 1,000,000, so this shift cannot collide.
update public.work_orders
set work_order_number = work_order_number + 1000000;

-- Assign contiguous numbers in creation order, oldest first, starting at 1001.
-- All existing work orders (including pending and rejected) are numbered so the
-- identifiers are globally sequential.
with ordered as (
  select id, row_number() over (order by created_at, id) as rn
  from public.work_orders
)
update public.work_orders w
set work_order_number = 1000 + ordered.rn
from ordered
where w.id = ordered.id;

alter table public.work_orders enable trigger user;

-- Continue the sequence after the new highest number so the next insert picks
-- up where the backfill left off. Falls back to 1000 on an empty table.
select setval(
  'public.work_orders_number_seq',
  coalesce((select max(work_order_number) from public.work_orders), 1000),
  true
);
