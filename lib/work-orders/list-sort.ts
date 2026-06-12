// Server-side sorting and pagination for the work order list tables. Like the
// filters, the URL query string is the source of truth: the server reads
// ?sort, ?dir, and ?page to order and slice the query, and the table and
// pagination controls write them back.

export const PAGE_SIZE = 10

export type SortDirection = 'asc' | 'desc'

export type SortKey =
  | 'code'
  | 'title'
  | 'category'
  | 'status'
  | 'priority'
  | 'property'
  | 'created'
  | 'due'
  | 'reporter'

export type ListSort = { key: SortKey; dir: SortDirection }

// Maps a sortable column to its database column and whether it can hold nulls
// (which always sort last). The Assignee column is intentionally absent: it is
// stored as a user id and only resolves to a name through a separate directory,
// so the database cannot order it the way users expect.
export const SORT_COLUMNS: Record<
  SortKey,
  { column: string; nullable: boolean }
> = {
  code: { column: 'work_order_number', nullable: false },
  title: { column: 'title', nullable: false },
  category: { column: 'category', nullable: false },
  status: { column: 'status', nullable: false },
  priority: { column: 'priority', nullable: false },
  property: { column: 'property', nullable: true },
  created: { column: 'created_at', nullable: false },
  due: { column: 'due_at', nullable: true },
  reporter: { column: 'reported_by_name', nullable: true },
}

// Status ascending follows the enum's workflow order (Open, In Progress, Done,
// Closed), so active work surfaces first by default.
export const DEFAULT_SORT: ListSort = { key: 'status', dir: 'asc' }

export function isSortable(key: string): key is SortKey {
  return Object.prototype.hasOwnProperty.call(SORT_COLUMNS, key)
}

type RawParams = Record<string, string | string[] | undefined>

function readString(params: RawParams, key: string): string {
  const value = params[key]
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

// Returns the explicit sort from the URL, or null when none is set (the caller
// falls back to DEFAULT_SORT for the query but shows no column indicator).
export function parseSort(params: RawParams): ListSort | null {
  const key = readString(params, 'sort')
  if (!isSortable(key)) return null
  const dir: SortDirection =
    readString(params, 'dir') === 'desc' ? 'desc' : 'asc'
  return { key, dir }
}

export function parsePage(params: RawParams): number {
  const raw = Number.parseInt(readString(params, 'page'), 10)
  return Number.isFinite(raw) && raw > 1 ? raw : 1
}
