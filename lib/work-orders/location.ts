import type { Property } from '@/lib/schemas/work-order'
import { propertyLabel, type PropertyLabels } from '@/lib/work-orders/properties'

// One-line location for a work order: the facility name, plus the unit when the
// work order names one. Returns null for work orders with no facility (IT is the
// one category where property is optional), so callers can skip the field.
export function formatLocation(
  property: Property | null,
  unitNumber: string | null,
  labels: PropertyLabels
): string | null {
  if (!property) return null
  const facility = propertyLabel(labels, property)
  return unitNumber ? `${facility} · Unit ${unitNumber}` : facility
}
