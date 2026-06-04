-- Allow editing and deleting work order notes.
-- Authors may edit and delete their own notes; administrators may also delete
-- any note (for moderation). Only the body is editable: a trigger keeps the
-- note's identity columns immutable, mirroring the work_orders pattern.

alter table public.work_order_notes
  add column if not exists updated_at timestamptz not null default now();

create trigger work_order_notes_set_updated_at
  before update on public.work_order_notes
  for each row execute function public.set_updated_at();

create or replace function public.enforce_work_order_note_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.work_order_id is distinct from old.work_order_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Only the note body may be edited'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_work_order_note_columns() from public;

create trigger work_order_notes_enforce_columns
  before update on public.work_order_notes
  for each row execute function public.enforce_work_order_note_columns();

-- Update: a note's author may edit their own note. The trigger above ensures
-- only the body actually changes.
create policy "Authors can update their work order notes"
  on public.work_order_notes
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- Delete: the author, or an administrator, may delete a note.
create policy "Authors or admins can delete work order notes"
  on public.work_order_notes
  for delete
  to authenticated
  using (
    created_by = auth.uid()
    or public.current_user_role() = 'administrator'
  );

grant update, delete on public.work_order_notes to authenticated;
