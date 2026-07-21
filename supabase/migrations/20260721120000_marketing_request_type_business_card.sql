-- Fix: work_orders_marketing_request_type_valid never included 'business_card',
-- even though the app added it as a selectable marketing request type
-- (MARKETING_REQUEST_TYPES in lib/schemas/work-order.ts) and a later migration
-- (20260626120039) already exempted it from the brief-required fields. Any
-- Business Card marketing submission has been rejected by this constraint since
-- business_card was introduced. Redefine the constraint to allow it.

alter table public.work_orders
  drop constraint if exists work_orders_marketing_request_type_valid;

alter table public.work_orders
  add constraint work_orders_marketing_request_type_valid
    check (
      marketing_request_type is null
      or marketing_request_type in (
        'event_flyer', 'monthly_special', 'informational_flyer',
        'business_card', 'other'
      )
    );
