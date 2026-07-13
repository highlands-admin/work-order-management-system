'use client'

import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  writePageSizeCookie,
  type PageSize,
} from '@/lib/work-orders/list-page-size'

// A record mapping every option to its own string, so the Select trigger can
// render the current value as a label.
const PAGE_SIZE_ITEMS: Record<string, string> = Object.fromEntries(
  PAGE_SIZE_OPTIONS.map((n) => [String(n), String(n)])
)

// The page numbers to show: always the first and last page, plus the current
// page and one neighbor on each side, with 'gap' markers standing in for the
// pages that are collapsed away. This keeps the first and last page one click
// away no matter how many pages there are.
function pageItems(current: number, total: number): (number | 'gap')[] {
  const pages = new Set<number>([1, total])
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) pages.add(p)
  }
  const sorted = [...pages].sort((a, b) => a - b)

  const items: (number | 'gap')[] = []
  let previous: number | undefined
  for (const p of sorted) {
    if (previous !== undefined) {
      // One missing page reads better as that page than as an ellipsis.
      if (p - previous === 2) items.push(previous + 1)
      else if (p - previous > 2) items.push('gap')
    }
    items.push(p)
    previous = p
  }
  return items
}

// Pagination driven by the ?page and ?size URL params, preserving the current
// filters and sort. The page-size dropdown is shown whenever there are rows;
// prev/next only when the rows span more than one page.
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

  function changePageSize(next: PageSize) {
    // Remember the choice so the next visit restores it; the server reads the
    // cookie when the URL carries no ?size.
    writePageSizeCookie(next)
    const params = new URLSearchParams(searchParams.toString())
    // A larger page can pull the current page out of range, so return to the
    // first page whenever the size changes.
    params.delete('page')
    if (next === DEFAULT_PAGE_SIZE) params.delete('size')
    else params.set('size', String(next))
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  if (total === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      {/* Left: the page-size setting. */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Rows per page</span>
        <Select
          items={PAGE_SIZE_ITEMS}
          value={String(pageSize)}
          onValueChange={(v) => changePageSize(Number(v) as PageSize)}
        >
          <SelectTrigger size="sm" aria-label="Rows per page" className="w-16">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Right: where you are, then how to move. */}
      <div className="flex items-center gap-4">
        <p className="text-sm text-muted-foreground tabular-nums">
          {from}–{to} of {total}
        </p>
        {totalPages > 1 ? (
          <nav className="flex items-center gap-1" aria-label="Pagination">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              disabled={current <= 1}
              onClick={() => goTo(current - 1)}
            >
              <RiArrowLeftSLine className="size-4" />
            </Button>

            {/* Numbered pages on wider screens; a compact "x of y" on mobile,
                where a full row of buttons would not fit. */}
            <div className="hidden items-center gap-1 sm:flex">
              {pageItems(current, totalPages).map((item, i) =>
                item === 'gap' ? (
                  <span
                    key={`gap-${i}`}
                    className="px-1 text-sm text-muted-foreground"
                    aria-hidden="true"
                  >
                    …
                  </span>
                ) : (
                  <Button
                    key={item}
                    variant={item === current ? 'default' : 'outline'}
                    size="sm"
                    aria-label={`Page ${item}`}
                    aria-current={item === current ? 'page' : undefined}
                    onClick={() => goTo(item)}
                    className="min-w-8 tabular-nums"
                  >
                    {item}
                  </Button>
                )
              )}
            </div>
            <span className="px-1 text-sm text-muted-foreground tabular-nums sm:hidden">
              {current} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              disabled={current >= totalPages}
              onClick={() => goTo(current + 1)}
            >
              <RiArrowRightSLine className="size-4" />
            </Button>
          </nav>
        ) : null}
      </div>
    </div>
  )
}
