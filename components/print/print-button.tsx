'use client'

import { RiPrinterLine } from '@remixicon/react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Opens the browser's own print dialog on the page the user is already looking
// at. The print stylesheet in globals.css is what turns that page into a sheet:
// the app frame drops away, the dark theme becomes ink on paper, and the table
// relays itself to the page width. Cmd+P does the same thing, so this button is
// a visible shortcut rather than a separate path through the app.
//
// A Client Component because window.print() exists only in the browser.
export function PrintButton({
  size = 'lg',
  className,
}: {
  size?: 'sm' | 'lg'
  className?: string
}): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      // The button is part of the screen chrome, so it leaves before the paper
      // does. Marked here rather than at each call site so every placement
      // inherits it.
      className={cn('print:hidden', className)}
      onClick={() => window.print()}
    >
      <RiPrinterLine className="size-4" />
      Print
    </Button>
  )
}
