'use client'

import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCalendarEventLine,
  RiMapPinLine,
  RiPauseCircleLine,
  RiPencilLine,
  RiRepeatLine,
  RiToolsLine,
  type RemixiconComponentType,
} from '@remixicon/react'
import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { CategoryBadge } from '@/components/work-orders/work-order-badge'
import {
  PROPERTY_LABELS,
  type Property,
  type RecurrenceFrequency,
  type WorkOrderCategory,
} from '@/lib/schemas/work-order'
import { occurrencesInRange } from '@/lib/work-orders/recurrence'
import { cn } from '@/lib/utils'

export type CalendarSchedule = {
  id: string
  title: string
  category: WorkOrderCategory
  property: Property | null
  unit_number: string | null
  frequency: RecurrenceFrequency
  recurrence_interval: number
  anchor_date: string
  provider: string | null
  active: boolean
  // Whether the current user may edit this specific schedule.
  editable: boolean
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_CHIPS = 3

// Adverb phrasing for the "Repeats …" line in a schedule's popover.
const FREQUENCY_ADVERBS: Record<RecurrenceFrequency, string> = {
  one_time: 'once',
  weekly: 'weekly',
  monthly: 'monthly',
  quarterly: 'quarterly',
  semiannual: 'semi-annually',
  annual: 'annually',
}

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
                  <ScheduleChip
                    key={s.id}
                    schedule={s}
                    date={d}
                    canEdit={s.editable}
                  />
                ))}
                {items.length > MAX_CHIPS ? (
                  <span className="px-1 text-xs text-muted-foreground">
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

// A calendar chip that pops a detail card on click, scaling out from the chip
// (the popover's transform origin), like an Apple Calendar event. Editors get an
// Edit button inside.
function ScheduleChip({
  schedule,
  date,
  canEdit,
}: {
  schedule: CalendarSchedule
  date: Date
  canEdit: boolean
}) {
  const dueLabel = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const location = schedule.property
    ? schedule.unit_number
      ? `${PROPERTY_LABELS[schedule.property]} · Unit ${schedule.unit_number}`
      : PROPERTY_LABELS[schedule.property]
    : null

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="block w-full truncate rounded-md bg-primary/10 px-2 py-1 text-left text-[13px] font-medium text-primary transition-colors hover:bg-primary/20"
          >
            {schedule.title}
          </button>
        }
      />
      <PopoverContent align="start" className="w-72 gap-0 overflow-hidden p-0">
        {/* Header: accent bar, then the title with the category to its right, and
            the occurrence date below. */}
        <div className="flex gap-3 px-4 pb-3.5 pt-4">
          <span
            aria-hidden="true"
            className="w-1 shrink-0 self-stretch rounded-full bg-primary"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <PopoverTitle className="min-w-0 font-heading text-[15px] font-semibold leading-relaxed">
                {schedule.title}
              </PopoverTitle>
              <CategoryBadge
                category={schedule.category}
                className="mt-0.5 shrink-0"
              />
            </div>
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <RiCalendarEventLine
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              {dueLabel}
            </p>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex flex-col gap-2.5 border-t px-4 py-3 text-xs">
          <MetaRow icon={RiRepeatLine}>
            Repeats {FREQUENCY_ADVERBS[schedule.frequency]}
          </MetaRow>
          {location ? <MetaRow icon={RiMapPinLine}>{location}</MetaRow> : null}
          {schedule.provider ? (
            <MetaRow icon={RiToolsLine}>{schedule.provider}</MetaRow>
          ) : null}
          {!schedule.active ? (
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <RiPauseCircleLine className="size-3.5 shrink-0" aria-hidden="true" />
              Paused
            </div>
          ) : null}
        </div>

        {canEdit ? (
          <div className="border-t p-2">
            <Link
              href={`/work-orders/recurring/${schedule.id}/edit`}
              className={buttonVariants({
                variant: 'ghost',
                size: 'sm',
                className: 'w-full justify-center gap-1.5',
              })}
            >
              <RiPencilLine className="size-3.5" aria-hidden="true" />
              Edit schedule
            </Link>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function MetaRow({
  icon: Icon,
  children,
}: {
  icon: RemixiconComponentType
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate text-foreground">{children}</span>
    </div>
  )
}
