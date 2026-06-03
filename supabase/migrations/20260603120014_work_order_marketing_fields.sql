-- Marketing-specific fields for work orders.
-- These columns are populated only for the 'marketing' category. Following the
-- existing property-required-for-non-IT pattern, check constraints require the
-- core marketing fields when category = 'marketing', and require the matching
-- free-text detail whenever an 'other' option is chosen. Allowed values are
-- enforced with check constraints rather than enums so the option lists stay
-- reversible and editable inside a normal transaction.
--
-- The statements use IF [NOT] EXISTS / DROP ... IF EXISTS guards so the
-- migration is safe to re-run after a partial failure.

alter table public.work_orders
  add column if not exists marketing_request_type          text,
  add column if not exists marketing_request_type_other    text,
  add column if not exists marketing_event_name            text,
  add column if not exists marketing_target_audience       text[],
  add column if not exists marketing_target_audience_other text,
  add column if not exists marketing_key_message           text,
  add column if not exists marketing_size_format           text[],
  add column if not exists marketing_size_format_other     text;

-- Backfill existing marketing work orders, which predate these columns and so
-- carry NULLs that would violate the required constraints below. A CHECK
-- constraint is re-evaluated on every update to a row, so leaving these rows
-- non-compliant would break unrelated updates (for example a technician status
-- transition) later. Placeholder values are marked so they can be corrected.
--
-- The work_orders_enforce_update_columns trigger rejects updates whose role is
-- not an editor, and migrations run without an authenticated role, so the
-- trigger is disabled for the backfill and restored immediately after.
alter table public.work_orders disable trigger work_orders_enforce_update_columns;

update public.work_orders
set
  marketing_request_type          = coalesce(marketing_request_type, 'other'),
  marketing_request_type_other    = coalesce(marketing_request_type_other, 'Imported, details not captured'),
  marketing_event_name            = coalesce(marketing_event_name, 'NA'),
  marketing_target_audience       = coalesce(marketing_target_audience, array['other']::text[]),
  marketing_target_audience_other = coalesce(marketing_target_audience_other, 'Imported, details not captured'),
  marketing_key_message           = coalesce(marketing_key_message, 'Imported, details not captured'),
  marketing_size_format           = coalesce(marketing_size_format, array['other']::text[]),
  marketing_size_format_other     = coalesce(marketing_size_format_other, 'Imported, details not captured')
where category = 'marketing';

alter table public.work_orders enable trigger work_orders_enforce_update_columns;

-- Constrain the option values.
alter table public.work_orders
  drop constraint if exists work_orders_marketing_request_type_valid,
  drop constraint if exists work_orders_marketing_size_format_valid,
  drop constraint if exists work_orders_marketing_target_audience_valid;

alter table public.work_orders
  add constraint work_orders_marketing_request_type_valid
    check (
      marketing_request_type is null
      or marketing_request_type in (
        'event_flyer', 'monthly_special', 'informational_flyer', 'other'
      )
    ),
  add constraint work_orders_marketing_size_format_valid
    check (
      marketing_size_format is null
      or marketing_size_format <@ array[
        'letter', 'half_sheet', 'social_media_post', 'social_media_story',
        'email', 'other'
      ]::text[]
    ),
  add constraint work_orders_marketing_target_audience_valid
    check (
      marketing_target_audience is null
      or marketing_target_audience <@ array[
        'residents', 'families', 'potential_residents', 'staff',
        'community_public', 'other'
      ]::text[]
    );

-- Require the core marketing fields for marketing work orders.
alter table public.work_orders
  drop constraint if exists work_orders_marketing_request_type_required,
  drop constraint if exists work_orders_marketing_event_name_required,
  drop constraint if exists work_orders_marketing_target_audience_required,
  drop constraint if exists work_orders_marketing_key_message_required,
  drop constraint if exists work_orders_marketing_size_format_required;

alter table public.work_orders
  add constraint work_orders_marketing_request_type_required
    check (category <> 'marketing' or marketing_request_type is not null),
  add constraint work_orders_marketing_event_name_required
    check (category <> 'marketing' or marketing_event_name is not null),
  add constraint work_orders_marketing_target_audience_required
    check (
      category <> 'marketing'
      or coalesce(array_length(marketing_target_audience, 1), 0) >= 1
    ),
  add constraint work_orders_marketing_key_message_required
    check (category <> 'marketing' or marketing_key_message is not null),
  add constraint work_orders_marketing_size_format_required
    check (
      category <> 'marketing'
      or coalesce(array_length(marketing_size_format, 1), 0) >= 1
    );

-- Require the free-text detail when an 'other' option is selected.
alter table public.work_orders
  drop constraint if exists work_orders_marketing_request_type_other_required,
  drop constraint if exists work_orders_marketing_size_format_other_required,
  drop constraint if exists work_orders_marketing_target_audience_other_required;

alter table public.work_orders
  add constraint work_orders_marketing_request_type_other_required
    check (
      marketing_request_type is distinct from 'other'
      or marketing_request_type_other is not null
    ),
  add constraint work_orders_marketing_size_format_other_required
    check (
      not ('other' = any(coalesce(marketing_size_format, '{}'::text[])))
      or marketing_size_format_other is not null
    ),
  add constraint work_orders_marketing_target_audience_other_required
    check (
      not ('other' = any(coalesce(marketing_target_audience, '{}'::text[])))
      or marketing_target_audience_other is not null
    );
