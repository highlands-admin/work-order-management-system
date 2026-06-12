'use client'

import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'

// Prev/next pagination driven by the ?page URL param, preserving the current
// filters and sort. Renders nothing when everything fits on one page.
export function TablePagination({
  page,
  pageSize,
  total,
}: {
  page: number
  pageSize: number
  total: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(page, 1), totalPages)
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1
  const to = Math.min(current * pageSize, total)

  function goTo(next: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (next <= 1) params.delete('page')
    else params.set('page', String(next))
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  if (total <= pageSize) return null

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground tabular-nums">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={current <= 1}
          onClick={() => goTo(current - 1)}
        >
          <RiArrowLeftSLine className="size-4" />
          Prev
        </Button>
        <span className="px-1 text-sm text-muted-foreground tabular-nums">
          Page {current} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={current >= totalPages}
          onClick={() => goTo(current + 1)}
        >
          Next
          <RiArrowRightSLine className="size-4" />
        </Button>
      </div>
    </div>
  )
}
