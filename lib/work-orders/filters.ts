// Filter state for the work-orders list page. The URL query string is the
// single source of truth: server components parse it to build the Supabase
// query, client components read it to populate the filter UI, and any change
// navigates to a new URL rather than holding ephemeral state.

import {
  PROPERTIES,
  WORK_ORDER_CATEGORIES,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'

export type WorkOrderFilters = {
  statuses: WorkOrderStatus[]
  priorities: WorkOrderPriority[]
  categories: WorkOrderCategory[]
  properties: Property[]
  assignees: string[]
  q: string
  dueFrom: string | null
  dueTo: string | null
  createdFrom: string | null
  createdTo: string | null
}

export const EMPTY_FILTERS: WorkOrderFilters = {
  statuses: [],
  priorities: [],
  categories: [],
  properties: [],
  assignees: [],
  q: '',
  dueFrom: null,
  dueTo: null,
  createdFrom: null,
  createdTo: null,
}

// URL param keys. Centralized so the parse and serialize paths can't drift.
export const PARAM = {
  status: 'status',
  priority: 'priority',
  category: 'category',
  property: 'property',
  assignee: 'assignee',
  q: 'q',
  dueFrom: 'dueFrom',
  dueTo: 'dueTo',
  createdFrom: 'createdFrom',
  createdTo: 'createdTo',
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

// Sentinel value for the "no assignee" filter option (distinct from any UUID).
export const UNASSIGNED = 'unassigned'

// Assignees are user UUIDs (a dynamic set, so there's no enum to validate
// against), plus the UNASSIGNED sentinel. Keep only those, deduped, so a
// malformed value can't reach the query.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function readAssigneeCsv(source: RawSearchParams, key: string): string[] {
  const raw = readString(source, key)
  if (!raw) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(',')) {
    const trimmed = part.trim().toLowerCase()
    if (
      (trimmed === UNASSIGNED || UUID.test(trimmed)) &&
      !seen.has(trimmed)
    ) {
      seen.add(trimmed)
      out.push(trimmed)
    }
  }
  return out
}

// Accept only YYYY-MM-DD so a malformed string can't reach the database query
// and so the date inputs round-trip predictably.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
function readDate(source: RawSearchParams, key: string): string | null {
  const raw = readString(source, key).trim()
  if (!raw || !ISO_DATE.test(raw)) return null
  const ts = Date.parse(`${raw}T00:00:00.000Z`)
  return Number.isNaN(ts) ? null : raw
}

export function parseWorkOrderFilters(
  source: RawSearchParams
): WorkOrderFilters {
  return {
    statuses: readCsv(source, PARAM.status, WORK_ORDER_STATUSES),
    priorities: readCsv(source, PARAM.priority, WORK_ORDER_PRIORITIES),
    categories: readCsv(source, PARAM.category, WORK_ORDER_CATEGORIES),
    properties: readCsv(source, PARAM.property, PROPERTIES),
    assignees: readAssigneeCsv(source, PARAM.assignee),
    q: readString(source, PARAM.q).slice(0, 200),
    dueFrom: readDate(source, PARAM.dueFrom),
    dueTo: readDate(source, PARAM.dueTo),
    createdFrom: readDate(source, PARAM.createdFrom),
    createdTo: readDate(source, PARAM.createdTo),
  }
}

// Build a URLSearchParams that captures only the non-empty filter values.
// The caller is responsible for stringifying or merging with other params.
export function toSearchParams(filters: WorkOrderFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.statuses.length) params.set(PARAM.status, filters.statuses.join(','))
  if (filters.priorities.length)
    params.set(PARAM.priority, filters.priorities.join(','))
  if (filters.categories.length)
    params.set(PARAM.category, filters.categories.join(','))
  if (filters.properties.length)
    params.set(PARAM.property, filters.properties.join(','))
  if (filters.assignees.length)
    params.set(PARAM.assignee, filters.assignees.join(','))
  if (filters.q) params.set(PARAM.q, filters.q)
  if (filters.dueFrom) params.set(PARAM.dueFrom, filters.dueFrom)
  if (filters.dueTo) params.set(PARAM.dueTo, filters.dueTo)
  if (filters.createdFrom) params.set(PARAM.createdFrom, filters.createdFrom)
  if (filters.createdTo) params.set(PARAM.createdTo, filters.createdTo)
  return params
}

export function hasActiveFilters(filters: WorkOrderFilters): boolean {
  return (
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    filters.categories.length > 0 ||
    filters.properties.length > 0 ||
    filters.assignees.length > 0 ||
    filters.q.length > 0 ||
    filters.dueFrom !== null ||
    filters.dueTo !== null ||
    filters.createdFrom !== null ||
    filters.createdTo !== null
  )
}

// Convenience for client navigation: take the current filters, mutate, and
// produce the new path's search string (without leading "?").
export function withFilter<K extends keyof WorkOrderFilters>(
  filters: WorkOrderFilters,
  key: K,
  value: WorkOrderFilters[K]
): WorkOrderFilters {
  return { ...filters, [key]: value }
}
