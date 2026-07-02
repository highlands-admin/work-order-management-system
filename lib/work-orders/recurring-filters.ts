// Filter state for the recurring schedules table. Like the main work order
// list, the URL query string is the single source of truth: the server parses
// it to build the Supabase query and the toolbar reads it to populate the
// controls. Any change navigates to a new URL rather than holding local state.

import {
  PROPERTIES,
  RECURRENCE_FREQUENCIES,
  WORK_ORDER_CATEGORIES,
  type Property,
  type RecurrenceFrequency,
  type WorkOrderCategory,
} from '@/lib/schemas/work-order'
import { UNASSIGNED } from '@/lib/work-orders/filters'

export type RecurringFilters = {
  categories: WorkOrderCategory[]
  properties: Property[]
  frequencies: RecurrenceFrequency[]
  assignees: string[]
  q: string
}

export const EMPTY_RECURRING_FILTERS: RecurringFilters = {
  categories: [],
  properties: [],
  frequencies: [],
  assignees: [],
  q: '',
}

// URL param keys. Centralized so the parse and serialize paths can't drift.
export const RECURRING_PARAM = {
  category: 'category',
  property: 'property',
  frequency: 'frequency',
  assignee: 'assignee',
  q: 'q',
} as const

type RawSearchParams =
  | URLSearchParams
  | Record<string, string | string[] | undefined>

function readString(source: RawSearchParams, key: string): string {
  if (source instanceof URLSearchParams) return source.get(key) ?? ''
  const value = source[key]
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function readCsv<T extends string>(
  source: RawSearchParams,
  key: string,
  allowed: readonly T[]
): T[] {
  const raw = readString(source, key)
  if (!raw) return []
  const allowedSet = new Set<string>(allowed)
  const seen = new Set<string>()
  const out: T[] = []
  for (const part of raw.split(',')) {
    const trimmed = part.trim()
    if (allowedSet.has(trimmed) && !seen.has(trimmed)) {
      seen.add(trimmed)
      out.push(trimmed as T)
    }
  }
  return out
}

// Assignees are user UUIDs (a dynamic set, so no enum to validate against) plus
// the UNASSIGNED sentinel. Keep only those, deduped, so a malformed value can't
// reach the query.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function readAssigneeCsv(source: RawSearchParams, key: string): string[] {
  const raw = readString(source, key)
  if (!raw) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(',')) {
    const trimmed = part.trim().toLowerCase()
    if ((trimmed === UNASSIGNED || UUID.test(trimmed)) && !seen.has(trimmed)) {
      seen.add(trimmed)
      out.push(trimmed)
    }
  }
  return out
}

export function parseRecurringFilters(
  source: RawSearchParams
): RecurringFilters {
  return {
    categories: readCsv(source, RECURRING_PARAM.category, WORK_ORDER_CATEGORIES),
    properties: readCsv(source, RECURRING_PARAM.property, PROPERTIES),
    frequencies: readCsv(
      source,
      RECURRING_PARAM.frequency,
      RECURRENCE_FREQUENCIES
    ),
    assignees: readAssigneeCsv(source, RECURRING_PARAM.assignee),
    q: readString(source, RECURRING_PARAM.q).slice(0, 200),
  }
}

// Build a URLSearchParams that captures only the non-empty filter values. The
// caller merges it with the params it wants to preserve (view, sort).
export function toRecurringSearchParams(
  filters: RecurringFilters
): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.categories.length) {
    params.set(RECURRING_PARAM.category, filters.categories.join(','))
  }
  if (filters.properties.length) {
    params.set(RECURRING_PARAM.property, filters.properties.join(','))
  }
  if (filters.frequencies.length) {
    params.set(RECURRING_PARAM.frequency, filters.frequencies.join(','))
  }
  if (filters.assignees.length) {
    params.set(RECURRING_PARAM.assignee, filters.assignees.join(','))
  }
  if (filters.q) params.set(RECURRING_PARAM.q, filters.q)
  return params
}

export function hasActiveRecurringFilters(filters: RecurringFilters): boolean {
  return (
    filters.categories.length > 0 ||
    filters.properties.length > 0 ||
    filters.frequencies.length > 0 ||
    filters.assignees.length > 0 ||
    filters.q.length > 0
  )
}

// Strip characters that would break PostgREST's .or() syntax or be read as
// ilike wildcards. The remaining string is wrapped with `*` on the query side.
function sanitizeSearchTerm(q: string): string {
  return q.replace(/[,()*%_\\]/g, '').trim().slice(0, 100)
}

// The subset of the Supabase query builder this helper chains. Each method
// returns the same builder, so the call-site type is preserved without
// depending on PostgREST's verbose generics.
interface FilterableQuery {
  in(column: string, values: readonly string[]): FilterableQuery
  or(filter: string): FilterableQuery
  is(column: string, value: null): FilterableQuery
}

export function applyRecurringFilters<Q>(
  query: Q,
  filters: RecurringFilters
): Q {
  let q = query as unknown as FilterableQuery

  if (filters.categories.length) q = q.in('category', filters.categories)
  if (filters.properties.length) q = q.in('property', filters.properties)
  if (filters.frequencies.length) q = q.in('frequency', filters.frequencies)

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

  const safeQ = sanitizeSearchTerm(filters.q)
  if (safeQ) {
    q = q.or(`title.ilike.*${safeQ}*,provider.ilike.*${safeQ}*`)
  }

  return q as unknown as Q
}
