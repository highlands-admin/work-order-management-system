// User-selectable page size for the work order list tables. Like sort and
// filters, the URL query string (?size) is the source of truth for a request,
// and the choice is mirrored to a cookie so a fresh visit restores it. All
// three lists (All Work Orders, My Work Orders, Archive) share one cookie,
// matching the shared column-widths cookie: they render the same table, so a
// choice on one is expected to carry over to the others.

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

export const DEFAULT_PAGE_SIZE: PageSize = 10

export const PAGE_SIZE_COOKIE = 'wo_page_size'

// One year, matching the longevity of the other list-preference cookies.
export const PAGE_SIZE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function toPageSize(raw: string | undefined): PageSize | null {
  const n = Number.parseInt(raw ?? '', 10)
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n)
    ? (n as PageSize)
    : null
}

// Resolve the effective page size for a request: an explicit, valid ?size wins;
// otherwise the persisted cookie; otherwise the default.
export function resolvePageSize(
  sizeParam: string | string[] | undefined,
  cookieValue: string | undefined
): PageSize {
  const fromUrl = toPageSize(Array.isArray(sizeParam) ? sizeParam[0] : sizeParam)
  if (fromUrl) return fromUrl
  return toPageSize(cookieValue) ?? DEFAULT_PAGE_SIZE
}

export function writePageSizeCookie(size: PageSize): void {
  document.cookie = `${PAGE_SIZE_COOKIE}=${size}; path=/; max-age=${PAGE_SIZE_COOKIE_MAX_AGE}; samesite=lax`
}
