'use client'

import {
  RiCalendar2Line,
  RiTableLine,
  type RemixiconComponentType,
} from '@remixicon/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { cn } from '@/lib/utils'

type View = 'calendar' | 'table'

export function RecurringViewToggle({ view }: { view: View }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setView(next: View) {
    const params = new URLSearchParams(searchParams.toString())
    // Calendar is the default, so it carries no param.
    if (next === 'calendar') params.delete('view')
    else params.set('view', next)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <div className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-muted p-0.5">
      <ToggleButton
        active={view === 'calendar'}
        onClick={() => setView('calendar')}
        icon={RiCalendar2Line}
        label="Calendar"
      />
      <ToggleButton
        active={view === 'table'}
        onClick={() => setView('table')}
        icon={RiTableLine}
        label="Table"
      />
    </div>
  )
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: RemixiconComponentType
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="size-4" aria-hidden={true} />
      {label}
    </button>
  )
}
