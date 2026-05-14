-- This project has "Automatically expose new tables" disabled, so new tables
-- do not receive grants for the Data API roles by default. RLS policies are
-- already in place; these grants just allow PostgREST to reach the tables so
-- the policies can run.

grant select, insert, update, delete on public.invitations to authenticated;
grant select, insert, update, delete on public.user_roles  to authenticated;
