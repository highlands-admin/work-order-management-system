// Pure date formatting shared by Server and Client Components. Every function
// takes an explicit IANA time zone (resolved on the server from the viewer's
// cookie) so the output is identical wherever it runs, which keeps Client
// Components from producing a hydration mismatch. The locale is pinned to
// en-US to match the rest of the app and stay deterministic.

import { formatDistanceToNowStrict } from 'date-fns'

export const TIMEZONE_COOKIE = 'tz'

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  ...DATE_OPTIONS,
  hour: 'numeric',
  minute: '2-digit',
}

export function formatDate(value: string, timeZone: string): string {
  return new Date(value).toLocaleString('en-US', { ...DATE_OPTIONS, timeZone })
}

export function formatDateTime(value: string, timeZone: string): string {
  return new Date(value).toLocaleString('en-US', {
    ...DATE_TIME_OPTIONS,
    timeZone,
  })
}

// Relative phrasing depends on the current clock, so it is the one value that
// cannot match between a server render and a later client render. Callers wrap
// it in an element with suppressHydrationWarning. Past a week it falls back to
// the absolute date, which does respect the time zone.
export function formatRelative(value: string, timeZone: string): string {
  const then = new Date(value).getTime()
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000))

  if (diffSec < 60) return 'just now'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return formatDateTime(value, timeZone)
}

// Full-word relative phrasing that scales from seconds to years, e.g.
// "5 minutes ago", "1 day ago", "1 month ago". Uses date-fns (already a
// dependency); the strict variant avoids fuzzy words like "about". Depends on
// the current clock, so use it only where the output is not hydrated (a Server
// Component) or guard it with suppressHydrationWarning.
export function formatRelativeLong(value: string): string {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true })
}
