-- Add 'license' and 'compliance' to the work_order_category enum.
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL,
-- so these statements are intentionally left outside any transaction block.
-- Supabase applies this migration directly against the live database.

alter type public.work_order_category add value 'license';
alter type public.work_order_category add value 'compliance';
