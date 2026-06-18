'use client'

import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  CATEGORY_LABELS,
  FREQUENCY_LABELS,
  type RecurrenceFrequency,
  type WorkOrderCategory,
} from '@/lib/schemas/work-order'
import { occurrencesInRange } from '@/lib/work-orders/recurrence'
import { cn } from '@/lib/utils'

export type CalendarSchedule = {
  id: string
  title: string
  category: WorkOrderCategory
  frequency: RecurrenceFrequency
  recurrence_interval: number
  anchor_date: string
  provider: string | null
  active: boolean
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_CHIPS = 3

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function RecurringCalendar({
  schedules,
}: {
  schedules: CalendarSchedule[]
}) {
  const today = new Date()
  const [month, setMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  )

  const { cells, byDate } = useMemo(() => {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
    // Start the grid on the Sunday on or before the first of the month.
    const gridStart = new Date(monthStart)
    gridStart.setDate(1 - monthStart.getDay())

    const cells: Date[] = []
    for (let i = 0; i < 42; i += 1) {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      cells.push(d)
    }

    const rangeStart = cells[0]
    const rangeEnd = cells[cells.length - 1]
    const byDate = new Map<string, CalendarSchedule[]>()

    for (const s of schedules) {
      // Skip paused recurring series; one_time still shows its single date.
      if (!s.active && s.frequency !== 'one_time') continue
      const occurrences = occurrencesInRange(
        s.anchor_date,
        s.frequency,
        s.recurrence_interval,
        rangeStart,
        rangeEnd
      )
      for (const occ of occurrences) {
        const key = dateKey(occ)
        const list = byDate.get(key)
        if (list) list.push(s)
        else byDate.set(key, [s])
      }
    }

    return { cells, byDate }
  }, [month, schedules])

  const monthLabel = month.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  const todayKey = dateKey(today)

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 shadow-md dark:shadow-none">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="font-heading text-base font-semibold tracking-tight">
          {monthLabel}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
            }
          >
            Today
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() =>
              setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
            }
          >
            <RiArrowLeftSLine className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            onClick={() =>
              setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
            }
          >
            <RiArrowRightSLine className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b bg-muted/30 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === month.getMonth()
          const key = dateKey(d)
          const isToday = key === todayKey
          const items = byDate.get(key) ?? []
          return (
            <div
              key={i}
              className={cn(
                'flex min-h-24 flex-col gap-1 border-b border-r p-1.5',
                // Drop the trailing right/bottom borders to avoid a double edge.
                (i + 1) % 7 === 0 && 'border-r-0',
                i >= 35 && 'border-b-0',
                !inMonth && 'bg-muted/20'
              )}
            >
              <span
                className={cn(
                  'flex size-6 items-center justify-center self-start rounded-full text-xs tabular-nums',
                  isToday
                    ? 'bg-primary font-semibold text-primary-foreground'
                    : inMonth
                      ? 'text-foreground'
                      : 'text-muted-foreground/60'
                )}
              >
                {d.getDate()}
              </span>

              <div className="flex flex-col gap-1">
                {items.slice(0, MAX_CHIPS).map((s) => (
                  <span
                    key={s.id}
                    title={`${s.title} · ${CATEGORY_LABELS[s.category]} · ${FREQUENCY_LABELS[s.frequency]}${s.provider ? ` · ${s.provider}` : ''}`}
                    className="truncate rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
                  >
                    {s.title}
                  </span>
                ))}
                {items.length > MAX_CHIPS ? (
                  <span className="px-1 text-[11px] text-muted-foreground">
                    +{items.length - MAX_CHIPS} more
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
