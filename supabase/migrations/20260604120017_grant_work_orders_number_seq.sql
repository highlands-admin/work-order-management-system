-- The work_orders.work_order_number column defaults to
-- nextval('work_orders_number_seq'). Evaluating that default during an INSERT
-- runs as the inserting role (authenticated via PostgREST), which needs USAGE
-- on the sequence. This grant was missing because the sequence was created
-- after the original table grants, so inserts failed with permission denied.

grant usage, select on sequence public.work_orders_number_seq to authenticated;
