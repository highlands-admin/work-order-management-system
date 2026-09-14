// Shared pieces of the printable work order list: the human-readable summary of
// the filters behind it. Printing happens in place (the browser's own dialog on
// the page the user is viewing), so this is read by the print-only sheet header
// rather than by a separate document route.

import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  PROPERTY_LABELS,
  STATUS_LABELS,
} from '@/lib/schemas/work-order'
import {
  SOURCE_LABELS,
  UNASSIGNED,
  type WorkOrderFilters,
} from '@/lib/work-orders/filters'

// Formats a YYYY-MM-DD filter bound without a time zone conversion. Passing the
// bare string to Date() would read it as UTC midnight, which prints as the
// previous day for any viewer west of Greenwich.
function formatPlainDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRange(from: string | null, to: string | null): string {
  if (from && to) return `${formatPlainDate(from)} to ${formatPlainDate(to)}`
  if (from) return `on or after ${formatPlainDate(from)}`
  return `on or before ${formatPlainDate(to as string)}`
}

// Describes the active filters as "Label: values" lines. A sheet that has left
// the screen still needs to say what it is a list of, so the printout carries
// the same facets the table was showing.
export function describeFilters(
  filters: WorkOrderFilters,
  assigneeLabelById: Record<string, string>
): string[] {
  const lines: string[] = []

  if (filters.q) lines.push(`Search: ${filters.q}`)
  if (filters.statuses.length) {
    lines.push(
      `Status: ${filters.statuses.map((s) => STATUS_LABELS[s]).join(', ')}`
    )
  }
  if (filters.priorities.length) {
    lines.push(
      `Priority: ${filters.priorities.map((p) => PRIORITY_LABELS[p]).join(', ')}`
    )
  }
  if (filters.categories.length) {
    lines.push(
      `Category: ${filters.categories.map((c) => CATEGORY_LABELS[c]).join(', ')}`
    )
  }
  if (filters.properties.length) {
    lines.push(
      `Facility: ${filters.properties.map((p) => PROPERTY_LABELS[p]).join(', ')}`
    )
  }
  if (filters.assignees.length) {
    const labels = filters.assignees.map((id) =>
      id === UNASSIGNED
        ? 'Unassigned'
        : (assigneeLabelById[id] ?? id.slice(0, 8))
    )
    lines.push(`Assignee: ${labels.join(', ')}`)
  }
  if (filters.sources.length) {
    lines.push(
      `Source: ${filters.sources.map((s) => SOURCE_LABELS[s]).join(', ')}`
    )
  }
  if (filters.createdFrom || filters.createdTo) {
    lines.push(`Created: ${formatRange(filters.createdFrom, filters.createdTo)}`)
  }
  if (filters.dueFrom || filters.dueTo) {
    lines.push(`Due: ${formatRange(filters.dueFrom, filters.dueTo)}`)
  }

  return lines
}
