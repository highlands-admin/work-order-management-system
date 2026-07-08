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
  | 'assignee'
  | 'reporter'

export type ListSort = { key: SortKey; dir: SortDirection }

// Maps a sortable column to its database column and whether it can hold nulls
// (which always sort last). Assignee sorts on assignee_name, a denormalized
// snapshot of the resolved display name -- assigned_to is just a user id, and
// the name it resolves to lives in auth.users, which isn't exposed to
// PostgREST for the database to sort by directly.
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
  assignee: { column: 'assignee_name', nullable: true },
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

// Whether the URL carries a `sort` param at all, regardless of value. Used to
// tell "this list's sort has been explicitly set (or reset)" apart from
// "never touched", which decides whether a fresh visit should rehydrate a
// persisted sort cookie.
export function hasSortParams(params: RawParams): boolean {
  return 'sort' in params
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
