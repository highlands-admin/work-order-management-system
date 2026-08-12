-- Add 'clinton' to the property enum. Inserted before 'corporate' so the
-- communities stay grouped ahead of the corporate office in enum order.
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL,
-- so this statement is intentionally left outside any transaction block.
-- Supabase applies this migration directly against the live database.

alter type public.property add value 'clinton' before 'corporate';
