-- Replace the backfilled work order titles (truncated descriptions) with short,
-- human-written titles. Rows are matched by their stable work_order_number.
-- The update-enforcement trigger rejects role-less updates, so it is disabled
-- for the duration of this data migration and restored immediately after.

alter table public.work_orders
  disable trigger work_orders_enforce_update_columns;

update public.work_orders as w
set title = v.title
from (values
  (1001, 'Fix fax ATA reception'),
  (1002, 'Krissy''s PC won''t connect to network'),
  (1003, 'Email access to reset Ring cameras'),
  (1004, 'Support group flyer'),
  (1005, 'Grant Relias access for Haven and Janice'),
  (1006, 'Forest City website video won''t play'),
  (1007, 'Add description field and attachments to WO system'),
  (1008, 'Replace dresser with two black dressers')
) as v(work_order_number, title)
where w.work_order_number = v.work_order_number;

alter table public.work_orders
  enable trigger work_orders_enforce_update_columns;
