import { cookies, headers } from 'next/headers'

import { TIMEZONE_COOKIE } from './format'

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

// Resolves the viewer's time zone for server-side date formatting. Order of
// preference: the cookie the browser set from Intl, then Vercel's IP-based
// guess (available on every request, but wrong behind a VPN), then UTC.
// Reading cookies() and headers() opts the caller into dynamic rendering; the
// authenticated pages that show dates are already dynamic.
export async function getTimeZone(): Promise<string> {
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get(TIMEZONE_COOKIE)?.value
  if (fromCookie && isValidTimeZone(fromCookie)) return fromCookie

  const headerStore = await headers()
  const fromVercel = headerStore.get('x-vercel-ip-timezone')
  if (fromVercel && isValidTimeZone(fromVercel)) return fromVercel

  return 'UTC'
}
