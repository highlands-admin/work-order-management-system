-- Make work orders searchable by their notes, not just their own fields.
--
-- Notes live in a separate table (work_order_notes), and PostgREST's .or()
-- search can only reference base-table columns. Rather than a second query per
-- search, we maintain a denormalized search_text column on work_orders that
-- concatenates the work order's own searchable fields with its note bodies. The
-- list search then runs a single substring match against this one column.
--
-- Substring matching (ilike '%term%') is kept rather than full-text search so
-- identifiers like work_order_code and unit_number stay matchable; a trigram
-- GIN index keeps the substring search fast.
--
-- Statements are idempotent so the migration re-runs cleanly.

create extension if not exists pg_trgm;

alter table public.work_orders
  add column if not exists search_text text;

-- Builds search_text from the row's own fields plus every note attached to it.
-- concat_ws skips nulls, so missing optional fields (unit_number, reporter) just
-- drop out. Runs BEFORE insert and update.
--
-- A note change refreshes search_text through a nested UPDATE issued by the
-- work_order_notes trigger below. That is not a user edit of the work order, so
-- when this fires at a nested trigger depth we keep the existing updated_at
-- instead of letting set_updated_at bump it. The trigger is named with a "zz_"
-- prefix so it runs after work_orders_set_updated_at (BEFORE row triggers fire
-- in alphabetical order), letting it override that bump.
create or replace function public.work_orders_set_search_text()
returns trigger
language plpgsql
as $$
begin
  new.search_text := concat_ws(' ',
    new.work_order_code,
    new.title,
    new.description,
    new.unit_number,
    new.reported_by_name,
    (select string_agg(n.body, ' ')
       from public.work_order_notes n
      where n.work_order_id = new.id)
  );

  if tg_op = 'UPDATE' and pg_trigger_depth() > 1 then
    new.updated_at := old.updated_at;
  end if;

  return new;
end;
$$;

drop trigger if exists work_orders_zz_search_text on public.work_orders;
create trigger work_orders_zz_search_text
  before insert or update on public.work_orders
  for each row execute function public.work_orders_set_search_text();

-- When a note is added, edited, or removed, recompute its work order's
-- search_text. SECURITY DEFINER because the note's author may not hold UPDATE
-- rights on the work order (RLS and the approval-transition guard), and this
-- cache refresh must not depend on that. The self-assignment is a no-op that
-- re-fires the BEFORE trigger above, which does the real recomputation. On a
-- work-order cascade delete the parent is already gone, so the update matches
-- no row and harmlessly does nothing.
create or replace function public.work_order_notes_refresh_search_text()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.work_orders
     set search_text = search_text
   where id = coalesce(new.work_order_id, old.work_order_id);
  return null;
end;
$$;

drop trigger if exists work_order_notes_search_text on public.work_order_notes;
create trigger work_order_notes_search_text
  after insert or update or delete on public.work_order_notes
  for each row execute function public.work_order_notes_refresh_search_text();

-- Backfill existing rows. Disable this table's user triggers for the duration:
-- the approval-transition guard rejects edits to pending/rejected rows without
-- an authenticated caller, and set_updated_at would rewrite every updated_at.
-- This is a one-time system write that computes search_text inline, so no
-- business-logic trigger should run.
alter table public.work_orders disable trigger user;

update public.work_orders w
   set search_text = concat_ws(' ',
     w.work_order_code,
     w.title,
     w.description,
     w.unit_number,
     w.reported_by_name,
     (select string_agg(n.body, ' ')
        from public.work_order_notes n
       where n.work_order_id = w.id)
   );

alter table public.work_orders enable trigger user;

-- Trigram index so ilike '%term%' against search_text stays fast.
create index if not exists work_orders_search_text_trgm_idx
  on public.work_orders using gin (search_text gin_trgm_ops);
