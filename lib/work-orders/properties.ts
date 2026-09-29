import type { Option } from '@/components/ui/multi-select-filter'

// A property (facility) as the app sees it. Each organization manages its own
// list in the properties table. Work orders store the stable key; the name is
// what users see and can change.
export type PropertyOption = {
  key: string
  name: string
  isActive: boolean
}

// Display names by key. Includes retired properties so older work orders
// still render their facility name.
export type PropertyLabels = Record<string, string>

// Mirrors the check constraint on properties.key.
export const PROPERTY_KEY_PATTERN = /^[a-z0-9]+(_[a-z0-9]+)*$/

export function toPropertyLabels(properties: PropertyOption[]): PropertyLabels {
  return Object.fromEntries(properties.map((p) => [p.key, p.name]))
}

// Falls back to the key when a label is missing, so a row never renders blank.
export function propertyLabel(
  labels: PropertyLabels,
  key: string | null | undefined
): string {
  if (!key) return ''
  return labels[key] ?? key
}

// Every property, retired ones included, so users can still filter historic
// work orders by a facility that is no longer offered on the forms.
export function toPropertyFilterOptions(
  properties: PropertyOption[]
): Option<string>[] {
  return properties.map((p) => ({
    value: p.key,
    label: p.isActive ? p.name : `${p.name} (retired)`,
  }))
}

// Properties a form may offer: the active ones, plus the current value when
// editing a work order whose property has since been retired, so the select
// does not silently drop it.
export function selectableProperties(
  properties: PropertyOption[],
  currentKey?: string | null
): PropertyOption[] {
  return properties.filter((p) => p.isActive || p.key === currentKey)
}

// Builds a key from a display name for a new property ("Forest City" becomes
// "forest_city"). Returns null when the name has no usable characters.
export function propertyKeyFromName(name: string): string | null {
  const key = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
    .replace(/_+$/g, '')
  return key.length > 0 ? key : null
}
