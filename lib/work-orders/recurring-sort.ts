// Server-side sorting for the recurring schedules table. Mirrors the main work
// order list-sort module: the URL query string (?sort, ?dir) is the source of
// truth, the table header writes it, and the page reads it to order the query.

export type SortDirection = 'asc' | 'desc'

export type RecurringSortKey =
  | 'title'
  | 'category'
  | 'provider'
  | 'frequency'
  | 'property'
  | 'due'
  | 'state'

export type RecurringSort = { key: RecurringSortKey; dir: SortDirection }

// Maps a sortable column to its database column and whether it can hold nulls
// (which always sort last). Assignee is intentionally absent: it is stored as a
// user id and only resolves to a name through a separate directory, so the
// database cannot order it the way users expect. Alerts and Recipients are
// array-length summaries, not meaningful sort keys.
export const RECURRING_SORT_COLUMNS: Record<
  RecurringSortKey,
  { column: string; nullable: boolean }
> = {
  title: { column: 'title', nullable: false },
  category: { column: 'category', nullable: false },
  provider: { column: 'provider', nullable: true },
  frequency: { column: 'frequency', nullable: false },
  property: { column: 'property', nullable: true },
  due: { column: 'next_due_at', nullable: true },
  state: { column: 'active', nullable: false },
}

export function isRecurringSortable(key: string): key is RecurringSortKey {
  return Object.prototype.hasOwnProperty.call(RECURRING_SORT_COLUMNS, key)
}

type RawParams = Record<string, string | string[] | undefined>

function readString(params: RawParams, key: string): string {
  const value = params[key]
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

// See hasSortParams in list-sort.ts -- same purpose, for the recurring list.
export function hasRecurringSortParams(params: RawParams): boolean {
  return 'sort' in params
}

// Returns the explicit sort from the URL, or null when none is set. The page
// falls back to its default ordering (active schedules first, soonest due next)
// for the query while the table shows no column indicator.
export function parseRecurringSort(params: RawParams): RecurringSort | null {
  const key = readString(params, 'sort')
  if (!isRecurringSortable(key)) return null
  const dir: SortDirection = readString(params, 'dir') === 'desc' ? 'desc' : 'asc'
  return { key, dir }
}
