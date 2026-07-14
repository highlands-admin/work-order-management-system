'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode, KeyboardEvent, MouseEvent } from 'react'

import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

// A work order's row plus its optional search-match excerpt, grouped in a
// <tbody> so the two navigate and highlight as a single unit. Clicking anywhere
// in the group opens the work order (except on inline links or buttons), and
// Enter or Space on the focused row does the same. Grouping in a tbody is what
// lets the row and its excerpt share one hover state; a plain pair of sibling
// rows could not without a wrapping element, which a table does not allow.
export function WorkOrderRowGroup({
  href,
  colSpan,
  excerpt,
  children,
}: {
  href: string
  // Column count, so the excerpt row can span the full table width.
  colSpan: number
  // The match excerpt shown beneath the row; omitted when there is no match.
  excerpt?: ReactNode
  children: ReactNode
}) {
  const router = useRouter()

  function handleClick(event: MouseEvent<HTMLTableRowElement>) {
    const target = event.target as HTMLElement
    if (target.closest('a, button, input, select, textarea, [role="button"]')) {
      return
    }
    router.push(href)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      router.push(href)
    }
  }

  // Hover lives on the group, so pointing at either row lights up both. Do not
  // add a per-row hover:* here: it would win the specificity tie against
  // group-hover on the row actually under the pointer, leaving that row unlit
  // while its sibling highlights.
  const rowClass = 'cursor-pointer group-hover:bg-muted/50'

  return (
    <tbody className="group">
      <TableRow
        role="link"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          rowClass,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          // The excerpt row below carries the divider, so the two read as one.
          excerpt ? 'border-b-0' : undefined
        )}
      >
        {children}
      </TableRow>
      {excerpt ? (
        <TableRow onClick={handleClick} className={rowClass}>
          <TableCell colSpan={colSpan} className="px-4 pb-3 pt-0">
            {excerpt}
          </TableCell>
        </TableRow>
      ) : null}
    </tbody>
  )
}
