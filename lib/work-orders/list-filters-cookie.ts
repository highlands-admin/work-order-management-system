// Remembered filter state per filterable list. Persisting the exact filter
// query string in a cookie lets a list restore what the user last set --
// including an explicitly cleared, empty state -- when they return via a
// plain navigation (e.g. clicking back to a sidebar tab), instead of
// resetting. The constants and normalizeFilterQuery are DOM-free so the
// server pages can import this module too; writeFilterCookie is the only
// piece that touches `document`, and only the client filter bars call it.

export const FILTERS_COOKIE = 'wo_filters'
export const MINE_FILTERS_COOKIE = 'wo_mine_filters'
export const ARCHIVE_FILTERS_COOKIE = 'wo_archive_filters'
export const RECURRING_FILTERS_COOKIE = 'wo_recurring_filters'

// One year, matching the longevity of the sidebar-state and view cookies.
export const FILTERS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

// A cookie value round-trips through the Cookie header, which may come back
// partially decoded depending on the runtime's cookie parser. Re-parsing
// through URLSearchParams normalizes either form into a clean, canonically
// encoded query string that's safe to drop straight into a redirect URL.
export function normalizeFilterQuery(raw: string | undefined): string {
  if (!raw) return ''
  return new URLSearchParams(raw).toString()
}

// Must run synchronously, before the navigation it precedes fires its
// request -- otherwise a filter-bar commit that clears the last active filter
// can race its own cookie write: the server reads the still-stale cookie and
// redirects right back to the filter that was just cleared. Kept as a plain
// top-level function (rather than inlined in a component) so a call from a
// handler reached through Base UI's `render` prop isn't misidentified by
// React Compiler's lint as a render-time mutation.
export function writeFilterCookie(name: string, query: string): void {
  document.cookie = `${name}=${query}; path=/; max-age=${FILTERS_COOKIE_MAX_AGE}; samesite=lax`
}
