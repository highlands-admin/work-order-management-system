// Remembered per-column widths for a resizable table. Keyed by column key
// rather than position, so a saved width still applies correctly even when a
// column is conditionally hidden on a particular list (e.g. My Work Orders
// hides Assignee, Archive hides Status). All Work Orders, My Work Orders, and
// Archive share one cookie -- they render the exact same table and columns,
// so a resize on one is expected to carry over to the others. The recurring
// schedules table has its own, since its column set is entirely different.

export const WORK_ORDERS_WIDTHS_COOKIE = 'wo_table_widths'
export const RECURRING_WIDTHS_COOKIE = 'wo_recurring_table_widths'

// One year, matching the longevity of the other list-preference cookies.
export const WIDTHS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

// Resizing has no "explicit vs default" ambiguity the way filters and sort
// do -- there's no action that means "reset to default", just continuous
// drags that always overwrite the latest value -- so an empty/invalid cookie
// simply means "no saved widths yet", not a distinct state to preserve.
export function parseWidthsCookieValue(
  raw: string | undefined
): Record<string, number> {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    const widths: Record<string, number> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        widths[key] = value
      }
    }
    return widths
  } catch {
    return {}
  }
}

// Only ever called once a resize completes (pointerup), not on every pointer
// move, so a drag doesn't spam cookie writes.
export function writeWidthsCookie(
  name: string,
  widths: Record<string, number>
): void {
  document.cookie = `${name}=${encodeURIComponent(
    JSON.stringify(widths)
  )}; path=/; max-age=${WIDTHS_COOKIE_MAX_AGE}; samesite=lax`
}
