'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

// Server Actions that redirect (create, edit, status transition) can't toast
// client-side because the redirect unmounts the form. Instead they append a
// coded `?flash=` param, which this component reads on the destination, toasts
// once, and strips so a refresh doesn't repeat it. Codes are mapped to messages
// here rather than passing free text through the URL.
const FLASH_MESSAGES: Record<string, string> = {
  created: 'Work order created.',
  submitted: 'Work order submitted for approval.',
  updated: 'Work order updated.',
  status: 'Status updated.',
}

export function ToastFlash() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const firedFor = useRef<string | null>(null)

  const flash = params.get('flash')

  useEffect(() => {
    if (!flash || firedFor.current === flash) return
    firedFor.current = flash

    const message = FLASH_MESSAGES[flash]
    if (message) toast.success(message)

    const next = new URLSearchParams(params.toString())
    next.delete('flash')
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [flash, params, pathname, router])

  return null
}
