import { cookies } from 'next/headers'

import { TIMEZONE_COOKIE } from './format'

// Used until the browser reports the real zone through the cookie. Every
// community the app serves is in the Eastern time zone, so this is right for
// almost every viewer, and it keeps TimezoneSync from firing a refresh on the
// first page load for those viewers.
const DEFAULT_TIME_ZONE = 'America/New_York'

// Validates a candidate IANA zone before it reaches toLocaleString, which
// throws a RangeError on an unknown time zone. The cookie value is
// client-controlled, so it cannot be trusted blindly.
function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

// Resolves the viewer's time zone for server-side date formatting. Prefers the
// cookie the browser set from Intl, and falls back to the default zone on the
// first request from a new browser. Reading cookies() opts the caller into
// dynamic rendering; the authenticated pages that show dates are already
// dynamic.
export async function getTimeZone(): Promise<string> {
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get(TIMEZONE_COOKIE)?.value
  if (fromCookie && isValidTimeZone(fromCookie)) return fromCookie

  return DEFAULT_TIME_ZONE
}
