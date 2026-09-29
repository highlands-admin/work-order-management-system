'use client'

import { useRouter } from 'next/navigation'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'

import { TableRow } from '@/components/ui/table'

// A table row that opens href when clicked anywhere, matching the work order
// tables. Clicks on links, buttons, and form controls inside the row keep their
// own behavior, so a title link still supports opening in a new tab. Enter or
// Space on the focused row navigates too.
export function LinkTableRow({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  const router = useRouter()

  function handleClick(event: MouseEvent<HTMLTableRowElement>): void {
    const target = event.target as HTMLElement
    if (target.closest('a, button, input, select, textarea, [role="button"]')) {
      return
    }
    router.push(href)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>): void {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      router.push(href)
    }
  }

  return (
    <TableRow
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </TableRow>
  )
}
