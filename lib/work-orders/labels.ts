// Display labels for the category-specific fields on a work order. The values
// are enum members with an "other" escape hatch that carries its text in a
// companion column, so resolving one to a label is more than a map lookup.
// Shared by the work order detail page and its printable sheet, which have to
// read the same way.

import {
  IT_REQUEST_TYPE_LABELS,
  MARKETING_REQUEST_TYPE_LABELS,
  MARKETING_SIZE_FORMAT_LABELS,
  MARKETING_TARGET_AUDIENCE_LABELS,
  type ITRequestType,
  type MarketingRequestType,
  type MarketingSizeFormat,
  type MarketingTargetAudience,
} from '@/lib/schemas/work-order'

// Each function returns null when the field was never filled in, leaving the
// caller to render its own empty marker.

export function itRequestTypeLabel(value: string | null): string | null {
  if (!value) return null
  return value in IT_REQUEST_TYPE_LABELS
    ? IT_REQUEST_TYPE_LABELS[value as ITRequestType]
    : value
}

export function marketingRequestTypeLabel(
  value: string | null,
  other: string | null
): string | null {
  if (!value) return null
  if (value === 'other') return other
  return value in MARKETING_REQUEST_TYPE_LABELS
    ? MARKETING_REQUEST_TYPE_LABELS[value as MarketingRequestType]
    : value
}

export function marketingAudienceLabel(
  values: string[] | null,
  other: string | null
): string | null {
  if (!values || values.length === 0) return null
  return values
    .map((v) =>
      v === 'other'
        ? (other ?? MARKETING_TARGET_AUDIENCE_LABELS.other)
        : v in MARKETING_TARGET_AUDIENCE_LABELS
          ? MARKETING_TARGET_AUDIENCE_LABELS[v as MarketingTargetAudience]
          : v
    )
    .join(', ')
}

export function marketingSizeFormatLabel(
  values: string[] | null,
  other: string | null
): string | null {
  if (!values || values.length === 0) return null
  return values
    .map((v) =>
      v === 'other'
        ? (other ?? MARKETING_SIZE_FORMAT_LABELS.other)
        : v in MARKETING_SIZE_FORMAT_LABELS
          ? MARKETING_SIZE_FORMAT_LABELS[v as MarketingSizeFormat]
          : v
    )
    .join(', ')
}
