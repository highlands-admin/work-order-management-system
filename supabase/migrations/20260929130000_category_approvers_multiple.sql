-- Allow multiple approvers per work order category. Every approver for the
-- category is emailed when a submission enters the approval queue. Existing
-- rows carry over unchanged, since a single approver per category remains valid
-- under the wider key.
--
-- Rollback (fails if any category has more than one approver; delete extras
-- first):
--   drop function if exists public.get_category_approvers(public.work_order_category);
--   alter table public.category_approvers drop constraint category_approvers_pkey;
--   alter table public.category_approvers add primary key (category);
--   then recreate get_category_approver from 20260929120000_category_approvers.sql
--   revoke select, insert, update, delete on public.category_approvers from authenticated;

-- 20260929120000 enabled RLS but did not grant table privileges, so every
-- query failed with "permission denied" before RLS ran. The policies still
-- restrict access to administrators.
grant select, insert, update, delete on public.category_approvers to authenticated;

alter table public.category_approvers drop constraint category_approvers_pkey;
alter table public.category_approvers add primary key (category, user_id);

-- Deleting a user cascades through user_id. The composite key leads with
-- category, so it cannot serve that lookup on its own.
create index category_approvers_user_id_idx
  on public.category_approvers (user_id);

drop function if exists public.get_category_approver(public.work_order_category);

-- Resolves contact details for every approver of a category. Runs as SECURITY
-- DEFINER because auth.users is not exposed to PostgREST and because the
-- caller is often a requester, who cannot read category_approvers. Skips
-- approvers who are no longer administrators, since only administrators can
-- act on the approval queue. Exposes nothing beyond what list_assignable_users
-- already returns.
create or replace function public.get_category_approvers(
  p_category public.work_order_category
)
returns table (
  user_id    uuid,
  email      text,
  first_name text,
  last_name  text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ca.user_id,
    u.email,
    (u.raw_user_meta_data ->> 'first_name'),
    (u.raw_user_meta_data ->> 'last_name')
  from public.category_approvers ca
  inner join auth.users u on u.id = ca.user_id
  inner join public.user_roles ur on ur.user_id = ca.user_id
  where ca.category = p_category
    and ur.role = 'administrator';
$$;

revoke execute on function public.get_category_approvers(public.work_order_category) from public;
grant  execute on function public.get_category_approvers(public.work_order_category) to authenticated;
