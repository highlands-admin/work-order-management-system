'use client'

import {
  RiCalendar2Line,
  RiTableLine,
  type RemixiconComponentType,
} from '@remixicon/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  RECURRING_VIEW_COOKIE,
  VIEW_COOKIE_MAX_AGE,
} from '@/lib/work-orders/list-view'
import { cn } from '@/lib/utils'

type View = 'calendar' | 'table'

export function RecurringViewToggle({ view }: { view: View }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setView(next: View) {
    // Remember the choice so the next visit (e.g. from the sidebar, with no
    // ?view param) opens in this view. The page reads the cookie server-side.
    document.cookie = `${RECURRING_VIEW_COOKIE}=${next}; path=/; max-age=${VIEW_COOKIE_MAX_AGE}; samesite=lax`
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
