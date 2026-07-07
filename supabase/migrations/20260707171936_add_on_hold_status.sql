-- Add the On Hold work order status: a deliberate pause on an approved work
-- order (waiting on a part, vendor, or access), distinct from actively open or
-- in-progress work. Sits alongside open/in_progress/done/closed as a status an
-- assignee or creator can move a work order into and back out of.
--
-- Postgres does not allow a newly-added enum value to be referenced in the
-- same transaction that adds it, so this migration only mutates the enum. The
-- policy and function updates that reference 'on_hold' land in the next
-- migration once this one has committed.

alter type public.work_order_status add value if not exists 'on_hold';
