-- Work order notes: any authenticated user may add a note to any work order.
-- Notes are immutable after creation. There are no UPDATE or DELETE policies,
-- so RLS denies both by default.

create table public.work_order_notes (
  id             uuid        primary key default gen_random_uuid(),
  work_order_id  uuid        not null references public.work_orders(id) on delete cascade,
  created_by     uuid        not null references auth.users(id)         on delete restrict,
  body           text        not null,
  created_at     timestamptz not null default now()
);

-- Powers the chronological note list within a work order.
create index work_order_notes_work_order_id_idx
  on public.work_order_notes (work_order_id, created_at asc);

alter table public.work_order_notes enable row level security;

-- Read: every authenticated user can see all notes.
create policy "Authenticated users can read work order notes"
  on public.work_order_notes
  for select
  to authenticated
  using (true);

-- Insert: any authenticated user may add a note, provided the row's
-- created_by equals their own user ID.
create policy "Authenticated users can add work order notes"
  on public.work_order_notes
  for insert
  to authenticated
  with check (created_by = auth.uid());

grant select, insert on public.work_order_notes to authenticated;
