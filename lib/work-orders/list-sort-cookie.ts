// Remembered sort per filterable list, mirroring list-filters-cookie.ts. The
// cookie value is `key:dir` for an explicit column sort, or an empty string
// for "explicitly reset to this list's default ordering" -- distinguishing
// that from "never touched", which falls through to the list's own default.
// DOM-free except writeSortCookie, so server pages can import this module too.

export const SORT_COOKIE = 'wo_sort'
export const MINE_SORT_COOKIE = 'wo_mine_sort'
export const ARCHIVE_SORT_COOKIE = 'wo_archive_sort'
export const RECURRING_SORT_COOKIE = 'wo_recurring_sort'

// One year, matching the longevity of the other list-preference cookies.
export const SORT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function parseSortCookieValue<Key extends string>(
  raw: string | undefined,
  isValidKey: (key: string) => key is Key
): { key: Key; dir: 'asc' | 'desc' } | null {
  if (!raw) return null
  const [key, dir] = raw.split(':')
  if (!key || !isValidKey(key)) return null
  return { key, dir: dir === 'desc' ? 'desc' : 'asc' }
}

// Must run synchronously, in the same click handler that triggers the sort's
// navigation -- see writeFilterCookie in list-filters-cookie.ts for why.
export function writeSortCookie(
  name: string,
  sort: { key: string; dir: 'asc' | 'desc' } | null
): void {
  const value = sort ? `${sort.key}:${sort.dir}` : ''
  document.cookie = `${name}=${value}; path=/; max-age=${SORT_COOKIE_MAX_AGE}; samesite=lax`
}
