'use client'

import { useRouter } from 'next/navigation'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'

import { TableRow } from '@/components/ui/table'

// Makes a recurring-schedule table row navigate to its edit page on click, while
// leaving inline links/buttons clickable on their own. With no href (non-editor),
// it renders a plain, non-interactive row. Mirrors WorkOrderRow.
export function RecurringRow({
  href,
  children,
}: {
  href?: string
  children: ReactNode
}) {
  const router = useRouter()

  if (!href) {
    return <TableRow className="align-top">{children}</TableRow>
  }

  function handleClick(event: MouseEvent<HTMLTableRowElement>) {
    const target = event.target as HTMLElement
    if (target.closest('a, button, input, select, textarea, [role="button"]')) {
      return
    }
    router.push(href!)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      router.push(href!)
    }
  }

  return (
    <TableRow
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="cursor-pointer align-top focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      {children}
    </TableRow>
  )
}
