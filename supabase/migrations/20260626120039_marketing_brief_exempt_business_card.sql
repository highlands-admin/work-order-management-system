-- Business Card marketing requests need only the request type. The application
-- (MARKETING_BRIEF_EXEMPT_REQUEST_TYPES in lib/schemas/work-order.ts) already
-- skips the rest of the marketing brief for them, so it submits the event name,
-- target audience, key message, and size/format as null. The original brief
-- constraints required those fields for every marketing work order, which
-- rejected valid Business Card submissions. Relax the four brief constraints to
-- exempt the 'business_card' request type, matching the application. The request
-- type itself stays required for all marketing work orders.

alter table public.work_orders
  drop constraint if exists work_orders_marketing_event_name_required,
  drop constraint if exists work_orders_marketing_target_audience_required,
  drop constraint if exists work_orders_marketing_key_message_required,
  drop constraint if exists work_orders_marketing_size_format_required;

alter table public.work_orders
  add constraint work_orders_marketing_event_name_required
    check (
      category <> 'marketing'
      or marketing_request_type = 'business_card'
      or marketing_event_name is not null
    ),
  add constraint work_orders_marketing_target_audience_required
    check (
      category <> 'marketing'
      or marketing_request_type = 'business_card'
      or coalesce(array_length(marketing_target_audience, 1), 0) >= 1
    ),
  add constraint work_orders_marketing_key_message_required
    check (
      category <> 'marketing'
      or marketing_request_type = 'business_card'
      or marketing_key_message is not null
    ),
  add constraint work_orders_marketing_size_format_required
    check (
      category <> 'marketing'
      or marketing_request_type = 'business_card'
      or coalesce(array_length(marketing_size_format, 1), 0) >= 1
    );
