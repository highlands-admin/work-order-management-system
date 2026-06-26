-- Add 'preventative_maintenance' to the work_order_category enum.
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL,
-- so this statement is intentionally left outside any transaction block.
-- Supabase applies this migration directly against the live database.

alter type public.work_order_category add value 'preventative_maintenance';
