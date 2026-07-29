import { PROPERTY_LABELS, type Property } from '@/lib/schemas/work-order'

// One-line location for a work order: the facility name, plus the unit when the
// work order names one. Returns null for work orders with no facility (IT is the
// one category where property is optional), so callers can skip the field.
export function formatLocation(
  property: Property | null,
  unitNumber: string | null
): string | null {
  if (!property) return null
  const facility = PROPERTY_LABELS[property]
  return unitNumber ? `${facility} · Unit ${unitNumber}` : facility
}
