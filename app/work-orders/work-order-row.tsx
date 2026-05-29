'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode, KeyboardEvent, MouseEvent } from 'react'

import { TableRow } from '@/components/ui/table'

// Makes a table row navigate to the work-order detail page on click while
// leaving inline links/buttons inside the row clickable on their own. Keyboard
// users can activate the row with Enter or Space.
export function WorkOrderRow({
  href,
  children,
}: {
  href: string
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

  return (
    <TableRow
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </TableRow>
  )
}
