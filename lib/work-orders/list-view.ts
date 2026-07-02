// Remembered list-view preferences. The chosen view (My Work Orders board vs.
// table, Recurring calendar vs. table) is stored in a cookie so the server can
// pick the right default on the next visit, before render, with no client-side
// flash. This module is DOM-free so both the server pages (which read the
// cookie) and the client toggles (which set it) can import it.

export const MINE_VIEW_COOKIE = 'mine_view'
export const RECURRING_VIEW_COOKIE = 'recurring_view'

// One year, matching the longevity of the sidebar-state cookie.
export const VIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

// Resolve the active view: an explicit URL param wins (so shared links behave),
// then the remembered cookie, then the page's default. Only values the page
// declares in `allowed` are honored, so a stale or malformed value can't select
// a view that no longer exists.
export function resolveView<T extends string>(
  allowed: readonly T[],
  paramValue: string | string[] | undefined,
  cookieValue: string | undefined,
  fallback: T
): T {
  const param = Array.isArray(paramValue) ? paramValue[0] : paramValue
  if (param && (allowed as readonly string[]).includes(param)) return param as T
  if (cookieValue && (allowed as readonly string[]).includes(cookieValue)) {
    return cookieValue as T
  }
  return fallback
}
