-- ---------------------------------------------------------------------------
-- Organization-scoped attachment keys
--
-- New attachment objects are stored under work-orders/<organization_id>/, so
-- the storage routes can reject a key from another organization by its prefix
-- alone. This trigger enforces the same rule when a key is linked to a work
-- order, so no app code path can attach another organization's object.
--
-- Existing rows keep their older work-orders/<uuid> keys. They all belong to
-- the original organization and the check only runs on insert, so they are
-- untouched.
--
-- Rollback:
--   drop trigger work_order_attachments_zz_enforce_key_org on public.work_order_attachments;
--   drop function public.enforce_attachment_key_org();
-- ---------------------------------------------------------------------------

-- Runs after work_order_attachments_set_org has copied the organization from
-- the work order (triggers of the same timing fire in name order, hence zz).
create or replace function public.enforce_attachment_key_org()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.object_key not like 'work-orders/' || new.organization_id::text || '/%' then
    raise exception 'Attachment key does not belong to this organization'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_attachment_key_org() from public, anon, authenticated;

create trigger work_order_attachments_zz_enforce_key_org
  before insert on public.work_order_attachments
  for each row execute function public.enforce_attachment_key_org();
