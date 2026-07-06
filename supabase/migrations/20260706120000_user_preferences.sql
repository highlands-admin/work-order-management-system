-- Per-user preferences. For now this holds only the facilities a user wants
-- their work order views to default to. It is a view preference, never used for
-- authorization: the row is user-editable, so it must not gate access to any
-- data (RLS elsewhere is unchanged). A user widening this list only changes
-- what their own lists default to, not what they are allowed to see.

create table public.user_preferences (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  facilities public.property[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

-- Every policy is scoped to the caller's own row. UPDATE also needs a SELECT
-- policy (Postgres reads the row before updating it), which the read policy
-- provides.
create policy "Users can read their own preferences"
  on public.user_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own preferences"
  on public.user_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own preferences"
  on public.user_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own preferences"
  on public.user_preferences
  for delete
  to authenticated
  using (auth.uid() = user_id);

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- "Automatically expose new tables" is disabled for this project, so grant the
-- Data API role access; RLS above still governs which rows it can touch.
grant select, insert, update, delete on public.user_preferences to authenticated;
