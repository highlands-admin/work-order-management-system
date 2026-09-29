-- Category approvers: one designated administrator per work order category who
-- is emailed when a submission in that category enters the approval queue.
-- Replaces the APPROVER_EMAIL_* environment variables so administrators can
-- change approvers from the app without a redeploy. Categories without a row
-- have no dedicated approver and rely on administrators watching the queue.
--
-- Rollback:
--   drop function if exists public.get_category_approver(public.work_order_category);
--   drop table if exists public.category_approvers;

create table public.category_approvers (
  category   public.work_order_category primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger category_approvers_set_updated_at
  before update on public.category_approvers
  for each row execute function public.set_updated_at();

alter table public.category_approvers enable row level security;

-- Only administrators manage or read the mapping directly. Other roles reach
-- the approver through get_category_approver, which returns a single row.
create policy "category_approvers_select_admin"
  on public.category_approvers for select
  to authenticated
  using (public.current_user_role() = 'administrator');

create policy "category_approvers_insert_admin"
  on public.category_approvers for insert
  to authenticated
  with check (public.current_user_role() = 'administrator');

create policy "category_approvers_update_admin"
  on public.category_approvers for update
  to authenticated
  using (public.current_user_role() = 'administrator')
  with check (public.current_user_role() = 'administrator');

create policy "category_approvers_delete_admin"
  on public.category_approvers for delete
  to authenticated
  using (public.current_user_role() = 'administrator');

-- Resolves the approver's contact details for a category. Runs as SECURITY
-- DEFINER because auth.users is not exposed to PostgREST and because the
-- caller is often a requester, who cannot read category_approvers. Returns no
-- row when the category has no approver or the approver is no longer an
-- administrator, since only administrators can act on the approval queue.
-- Exposes nothing beyond what list_assignable_users already returns.
create or replace function public.get_category_approver(
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

revoke execute on function public.get_category_approver(public.work_order_category) from public;
grant  execute on function public.get_category_approver(public.work_order_category) to authenticated;
