-- Add 'corporate' to the property enum for work orders that belong to the
-- corporate office rather than a senior living community.
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL,
-- so this statement is intentionally left outside any transaction block.
-- Supabase applies this migration directly against the live database.

alter type public.property add value 'corporate';
