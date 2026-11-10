-- Default assignees: who picks up a work order when it goes live with nobody
-- chosen, so routed work never sits in the main list unowned. Administrators
-- manage the mapping at /admin/default-assignees.
--
-- A row with it_request_type null is the category's default. For the 'it'
-- category, a row with an it_request_type overrides the category default for
-- that type of request. Categories without a row stay unassigned until someone
-- picks an assignee by hand.
--
-- The app applies the default when an administrator files a work order with
-- no assignee, and when a submission is approved with no assignee. Only
-- administrators do either, so only administrators read the table and no
-- SECURITY DEFINER lookup is needed.
--
-- Rollback:
--   drop table if exists public.default_assignees;
--   drop function if exists public.enforce_default_assignee_same_org();

create table public.default_assignees (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null default public.current_org_id()
                                references public.organizations(id) on delete cascade,
  category        public.work_order_category not null,
  -- Mirrors work_orders.it_request_type, which is plain text validated in the
  -- app. Only the 'it' category has request types.
  it_request_type text        check (it_request_type is null or category = 'it'),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- One default per category, and one per IT request type, in each
  -- organization. NULLS NOT DISTINCT makes the category default (null type)
  -- unique too.
  unique nulls not distinct (organization_id, category, it_request_type)
);

-- Deleting a user cascades through user_id. The unique key leads with
-- organization_id, so it cannot serve that lookup on its own.
create index default_assignees_user_id_idx
  on public.default_assignees (user_id);

create trigger default_assignees_set_updated_at
  before update on public.default_assignees
  for each row execute function public.set_updated_at();

-- The default assignee must belong to the row's organization. Without this a
-- caller who knows another organization's user id could store it, and every
-- work order it applied to would then fail the same-organization check on
-- work_orders.
create or replace function public.enforce_default_assignee_same_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = new.user_id
      and ur.organization_id = new.organization_id
  ) then
    raise exception 'Default assignees must belong to the same organization'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_default_assignee_same_org() from public, anon, authenticated;

create trigger default_assignees_enforce_same_org
  before insert or update on public.default_assignees
  for each row execute function public.enforce_default_assignee_same_org();

alter table public.default_assignees enable row level security;

grant select, insert, update, delete on public.default_assignees to authenticated;

create policy "default_assignees_select_admin"
  on public.default_assignees for select
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
  );

create policy "default_assignees_insert_admin"
  on public.default_assignees for insert
  to authenticated
  with check (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
  );

create policy "default_assignees_update_admin"
  on public.default_assignees for update
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
  )
  with check (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
  );

create policy "default_assignees_delete_admin"
  on public.default_assignees for delete
  to authenticated
  using (
    organization_id = (select public.current_org_id())
    and public.current_user_role() = 'administrator'
  );
