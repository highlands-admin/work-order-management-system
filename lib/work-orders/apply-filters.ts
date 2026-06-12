import { UNASSIGNED, type WorkOrderFilters } from './filters'

// Strip characters that would either break PostgREST's .or() syntax or be
// interpreted as ilike wildcards. The remaining string is wrapped with `*`
// wildcards on the query side.
function sanitizeSearchTerm(q: string): string {
  return q.replace(/[,()*%_\\]/g, '').trim().slice(0, 100)
}

// The subset of the Supabase query builder this helper chains. Each method
// returns the same builder, so the generic call-site type is preserved without
// depending on PostgREST's verbose generics.
interface FilterableQuery {
  in(column: string, values: readonly string[]): FilterableQuery
  or(filter: string): FilterableQuery
  is(column: string, value: null): FilterableQuery
  gte(column: string, value: string): FilterableQuery
  lte(column: string, value: string): FilterableQuery
}

// Applies the work-order list filters to a Supabase query. Shared by the All
// Work Orders and My Work Orders pages so the two stay in lockstep. The assignee
// filter is honored only when present; My Work Orders clears it because every
// row is already the current user's.
export function applyWorkOrderFilters<Q>(
  query: Q,
  filters: WorkOrderFilters
): Q {
  let q = query as unknown as FilterableQuery

  if (filters.statuses.length) q = q.in('status', filters.statuses)
  if (filters.priorities.length) q = q.in('priority', filters.priorities)
  if (filters.categories.length) q = q.in('category', filters.categories)
  if (filters.properties.length) q = q.in('property', filters.properties)

  if (filters.assignees.length) {
    const includeUnassigned = filters.assignees.includes(UNASSIGNED)
    const ids = filters.assignees.filter((a) => a !== UNASSIGNED)
    if (includeUnassigned && ids.length) {
      q = q.or(`assigned_to.is.null,assigned_to.in.(${ids.join(',')})`)
    } else if (includeUnassigned) {
      q = q.is('assigned_to', null)
    } else {
      q = q.in('assigned_to', ids)
    }
  }

  if (filters.dueFrom) q = q.gte('due_at', `${filters.dueFrom}T00:00:00.000Z`)
  if (filters.dueTo) q = q.lte('due_at', `${filters.dueTo}T23:59:59.999Z`)
  if (filters.createdFrom) {
    q = q.gte('created_at', `${filters.createdFrom}T00:00:00.000Z`)
  }
  if (filters.createdTo) {
    q = q.lte('created_at', `${filters.createdTo}T23:59:59.999Z`)
  }

  const safeQ = sanitizeSearchTerm(filters.q)
  if (safeQ) {
    q = q.or(
      `work_order_code.ilike.*${safeQ}*,title.ilike.*${safeQ}*,description.ilike.*${safeQ}*,unit_number.ilike.*${safeQ}*,reported_by_name.ilike.*${safeQ}*`
    )
  }

  return q as unknown as Q
}
