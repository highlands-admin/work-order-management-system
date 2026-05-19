-- Approval queue: introduce the pending and rejected states.
--
-- Postgres does not allow a newly-added enum value to be referenced in the
-- same transaction that adds it, so this migration only mutates the enum.
-- The columns, policies, and triggers that read these values land in the
-- next migration once this one has committed.

alter type public.work_order_status add value if not exists 'pending';
alter type public.work_order_status add value if not exists 'rejected';
