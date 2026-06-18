'use client'

import { RiArrowLeftLine } from '@remixicon/react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'

// Goes back to wherever the user came from (the list, the approval queue, a
// search result) rather than always to a fixed page. Falls back to fallbackHref
// when there is no in-app history, for example on a fresh tab or a shared link
// opened directly.
export function BackButton({
  fallbackHref = '/work-orders',
}: {
  fallbackHref?: string
}) {
  const router = useRouter()

  function handleBack() {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <Button type="button" variant="outline" size="lg" onClick={handleBack}>
      <RiArrowLeftLine className="size-4" />
      Back
    </Button>
  )
}
