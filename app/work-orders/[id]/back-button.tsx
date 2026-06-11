'use client'

import { RiArrowLeftLine } from '@remixicon/react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'

// Goes back to wherever the user came from (the list, the approval queue, a
// search result) rather than always to the work orders table. Falls back to
// the list when there is no in-app history, for example on a fresh tab or a
// shared link opened directly.
export function BackButton() {
  const router = useRouter()

  function handleBack() {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/work-orders')
    }
  }

  return (
    <Button type="button" variant="outline" size="lg" onClick={handleBack}>
      <RiArrowLeftLine className="size-4" />
      Back
    </Button>
  )
}
