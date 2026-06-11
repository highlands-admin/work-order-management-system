'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { TIMEZONE_COOKIE } from '@/lib/datetime/format'

// Detects the viewer's time zone in the browser and stores it in a cookie so
// the server formats dates correctly on later requests. It only writes and
// refreshes when the detected zone differs from the one the server already
// used, so after the first visit it does nothing. Renders nothing.
export function TimezoneSync({
  serverTimeZone,
}: {
  serverTimeZone: string
}): null {
  const router = useRouter()

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!detected || detected === serverTimeZone) return
    document.cookie = `${TIMEZONE_COOKIE}=${detected}; path=/; max-age=31536000; samesite=lax`
    // Re-render the server components with the now-correct cookie.
    router.refresh()
  }, [serverTimeZone, router])

  return null
}
