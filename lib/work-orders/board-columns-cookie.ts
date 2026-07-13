// Which status columns a user has chosen to show on the My Work Orders Kanban
// board. Persisted per browser so the board opens the same way on the next
// visit. Only the main-table statuses are ever board columns, so any other
// value in a stale or tampered cookie is dropped on read.

import {
  MAIN_TABLE_STATUSES,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'

export const MINE_BOARD_COLUMNS_COOKIE = 'wo_board_columns'

// One year, matching the longevity of the other list-preference cookies.
export const BOARD_COLUMNS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

// Columns shown until a user picks their own set. On Hold is off by default
// because it's the least-used status day to day; users who want it can turn it
// on in the picker, and that choice is then persisted.
export const DEFAULT_BOARD_COLUMNS: readonly WorkOrderStatus[] =
  MAIN_TABLE_STATUSES.filter((status) => status !== 'on_hold')

// Returns the saved columns in canonical order, or null when there is no valid
// saved selection yet (the caller then defaults to showing every column). An
// empty selection is meaningless for a board, so it collapses to null as well.
// Order is always canonical regardless of how the cookie was written, since the
// board does not support reordering, only showing and hiding.
export function parseBoardColumnsCookieValue(
  raw: string | undefined
): WorkOrderStatus[] | null {
  if (!raw) return null
  const saved = new Set(raw.split(','))
  const columns = MAIN_TABLE_STATUSES.filter((status) => saved.has(status))
  return columns.length > 0 ? columns : null
}

export function writeBoardColumnsCookie(columns: WorkOrderStatus[]): void {
  document.cookie = `${MINE_BOARD_COLUMNS_COOKIE}=${columns.join(
    ','
  )}; path=/; max-age=${BOARD_COLUMNS_COOKIE_MAX_AGE}; samesite=lax`
}
