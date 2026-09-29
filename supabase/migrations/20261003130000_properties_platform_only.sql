-- ---------------------------------------------------------------------------
-- Properties are managed by platform admins only
--
-- Organization administrators no longer add, rename, or retire properties.
-- Platform admins manage them through the platform_* functions from
-- 20261002120000_platform_admin.sql, which bypass RLS and check super admin
-- status themselves. Members keep read access to their own organization's
-- properties for the work order forms and filters.
--
-- Rollback: recreate the two policies below from
-- 20261001120000_org_properties.sql and
--   grant insert, update on public.properties to authenticated;
-- ---------------------------------------------------------------------------

drop policy "Admins add properties" on public.properties;
drop policy "Admins update properties" on public.properties;

revoke insert, update, delete on public.properties from authenticated;
