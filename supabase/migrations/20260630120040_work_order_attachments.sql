-- Work order attachments: image files stored in self-hosted MinIO (S3
-- compatible) on the IONOS server. The file bytes live in object storage; this
-- table holds only the object key and metadata, linked to a work order.
--
-- Attachments are immutable after creation: there is no UPDATE policy, so RLS
-- denies updates by default. Insert and delete mirror who may work a work
-- order (an administrator, the creator, or the current assignee), which also
-- covers technician and inspector assignees.

create table public.work_order_attachments (
  id                 uuid        primary key default gen_random_uuid(),
  work_order_id      uuid        not null references public.work_orders(id) on delete cascade,
  -- The object key within the MinIO bucket, for example
  -- "work-orders/9f1c....jpg". Unique so the same object cannot be linked twice.
  object_key         text        not null unique,
  content_type       text        not null,
  size_bytes         bigint      not null,
  original_filename  text,
  uploaded_by        uuid        not null references auth.users(id) on delete restrict,
  created_at         timestamptz not null default now()
);

-- Powers the attachment gallery on a work order, oldest first.
create index work_order_attachments_work_order_id_idx
  on public.work_order_attachments (work_order_id, created_at asc);

alter table public.work_order_attachments enable row level security;

-- Read: every authenticated user can see attachment rows, matching the
-- read-all policy on work_orders. The objects themselves stay private in
-- MinIO and are reachable only through short-lived presigned URLs the server
-- mints when rendering an authenticated page.
create policy "Authenticated users can read work order attachments"
  on public.work_order_attachments
  for select
  to authenticated
  using (true);

-- Insert: the uploader must be the caller, and the caller must be allowed to
-- work the parent work order (administrator, creator, or assignee). The
-- deleting of the file bytes from MinIO is handled by the Server Action; this
-- policy only governs the database row.
create policy "Workers can add work order attachments"
  on public.work_order_attachments
  for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1
      from public.work_orders wo
      where wo.id = work_order_id
        and (
          public.current_user_role() = 'administrator'
          or wo.created_by = auth.uid()
          or wo.assigned_to = auth.uid()
        )
    )
  );

-- Delete: same audience as insert. An administrator, the creator, or the
-- assignee may remove an attachment.
create policy "Workers can delete work order attachments"
  on public.work_order_attachments
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.work_orders wo
      where wo.id = work_order_id
        and (
          public.current_user_role() = 'administrator'
          or wo.created_by = auth.uid()
          or wo.assigned_to = auth.uid()
        )
    )
  );

grant select, insert, delete on public.work_order_attachments to authenticated;
