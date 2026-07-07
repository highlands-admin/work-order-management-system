'use client'

import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiExpandUpDownLine,
} from '@remixicon/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, type PointerEvent } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
} from '@/components/ui/table'
import { formatDateTime } from '@/lib/datetime/format'
import {
  CATEGORY_LABELS,
  FREQUENCY_LABELS,
  PROPERTY_LABELS,
  type Property,
  type RecurrenceFrequency,
  type WorkOrderCategory,
} from '@/lib/schemas/work-order'
import {
  RECURRING_WIDTHS_COOKIE,
  writeWidthsCookie,
} from '@/lib/work-orders/list-column-widths-cookie'
import {
  RECURRING_SORT_COOKIE,
  writeSortCookie,
} from '@/lib/work-orders/list-sort-cookie'
import {
  isRecurringSortable,
  type RecurringSort,
  type SortDirection,
} from '@/lib/work-orders/recurring-sort'

import { RecurringRow } from './recurring-row'

export type RecurringTableRow = {
  id: string
  title: string
  category: WorkOrderCategory
  property: Property | null
  unit_number: string | null
  provider: string | null
  frequency: RecurrenceFrequency
  next_due_at: string | null
  reminder_lead_days: number[]
  reminder_recipients: string[]
  assigned_to: string | null
  active: boolean
  // Whether the current user may edit this specific schedule.
  editable: boolean
}

// Default column widths in pixels. Users drag the handles to resize, matching the
// main work orders table.
const COLUMNS = [
  { key: 'title', label: 'Title', width: 200 },
  { key: 'category', label: 'Category', width: 200 },
  { key: 'provider', label: 'Provider', width: 160 },
  { key: 'frequency', label: 'Frequency', width: 130 },
  { key: 'property', label: 'Facility', width: 140 },
  { key: 'due', label: 'Next due', width: 180 },
  { key: 'alerts', label: 'Alerts', width: 110 },
  { key: 'recipients', label: 'Recipients', width: 120 },
  { key: 'assignee', label: 'Assignee', width: 160 },
  { key: 'state', label: 'State', width: 110 },
] as const

const MIN_WIDTH = 60

// Keyed by column key rather than index, matching the main work orders table,
// so a resize survives if the column set ever changes.
type ResizeState = {
  key: string
  startX: number
  startWidth: number
}

export function RecurringTable({
  schedules,
  userLabelById,
  timeZone,
  sort,
  initialColumnWidths,
}: {
  schedules: RecurringTableRow[]
  userLabelById: Record<string, string>
  timeZone: string
  sort: RecurringSort | null
  // Server-resolved persisted widths, keyed by column key -- see the same prop
  // on WorkOrdersTable for why this is passed down rather than read from the
  // cookie on the client.
  initialColumnWidths?: Record<string, number>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [widths, setWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    for (const c of COLUMNS) initial[c.key] = initialColumnWidths?.[c.key] ?? c.width
    return initial
  })
  // Read inside the resize-end handler -- see the same ref on WorkOrdersTable.
  const widthsRef = useRef(widths)
  useEffect(() => {
    widthsRef.current = widths
  }, [widths])
  const [resizing, setResizing] = useState<ResizeState | null>(null)

  // Sorting is server-side: cycle a column ascending -> descending -> default
  // (the page's active-first ordering), and let the URL drive the query. Other
  // params (view, filters) are preserved. Persisted the same way as the
  // filters: remember the choice (including an explicit reset to default) so
  // returning via a plain navigation restores it instead of resetting.
  function toggleSort(key: string) {
    if (!isRecurringSortable(key)) return
    let nextDir: SortDirection | null
    if (sort?.key !== key) nextDir = 'asc'
    else if (sort.dir === 'asc') nextDir = 'desc'
    else nextDir = null

    writeSortCookie(
      RECURRING_SORT_COOKIE,
      nextDir === null ? null : { key, dir: nextDir }
    )

    const params = new URLSearchParams(searchParams.toString())
    if (nextDir === null) {
      params.delete('sort')
      params.delete('dir')
    } else {
      params.set('sort', key)
      params.set('dir', nextDir)
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  // Track the pointer on the window during a drag so it can leave the narrow
  // handle without dropping the resize. Same pattern as the work orders table.
  useEffect(() => {
    if (!resizing) return

    function onMove(event: globalThis.PointerEvent) {
      const delta = event.clientX - resizing!.startX
      const nextWidth = Math.max(MIN_WIDTH, resizing!.startWidth + delta)
      setWidths((prev) => ({ ...prev, [resizing!.key]: nextWidth }))
    }

    function onUp() {
      setResizing(null)
      writeWidthsCookie(RECURRING_WIDTHS_COOKIE, widthsRef.current)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [resizing])

  function startResize(key: string, event: PointerEvent<HTMLSpanElement>) {
    event.preventDefault()
    setResizing({ key, startX: event.clientX, startWidth: widths[key] })
  }

  const totalWidth = COLUMNS.reduce((sum, c) => sum + widths[c.key], 0)

  return (
    <div
      className="w-fit max-w-full overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 shadow-md dark:shadow-none"
      style={resizing ? { userSelect: 'none', cursor: 'col-resize' } : undefined}
    >
      <Table className="table-fixed" style={{ width: totalWidth }}>
        <colgroup>
          {COLUMNS.map((col) => (
            <col key={col.key} style={{ width: widths[col.key] }} />
          ))}
        </colgroup>
        <TableHeader>
          <tr className="border-b bg-muted/40">
            {COLUMNS.map((col, i) => {
              const sortable = isRecurringSortable(col.key)
              const active = sortable && sort?.key === col.key
              return (
                <th
                  key={col.key}
                  aria-sort={
                    active
                      ? sort?.dir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                  className="relative h-10 select-none px-4 text-left align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="group/sort flex w-full items-center gap-1 pr-2 text-left uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <span className="truncate">{col.label}</span>
                      <SortIndicator
                        active={active}
                        dir={active ? sort?.dir : undefined}
                      />
                    </button>
                  ) : (
                    <span className="truncate">{col.label}</span>
                  )}
                  {i < COLUMNS.length - 1 ? (
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${col.label} column`}
                      onPointerDown={(e) => startResize(col.key, e)}
                      className="absolute right-0 top-0 z-10 flex h-full w-2 cursor-col-resize touch-none items-stretch justify-center hover:bg-border/70 active:bg-border"
                    >
                      <span className="my-2 w-px bg-border" aria-hidden="true" />
                    </span>
                  ) : null}
                </th>
              )
            })}
          </tr>
        </TableHeader>
        <TableBody>
          {schedules.map((row) => (
            <RecurringRow
              key={row.id}
              href={
                row.editable
                  ? `/work-orders/recurring/${row.id}/edit`
                  : undefined
              }
            >
              <TableCell className="truncate px-4 py-3 align-top font-medium text-foreground">
                {row.title}
              </TableCell>
              <TableCell className="truncate px-4 py-3 align-top">
                {CATEGORY_LABELS[row.category]}
              </TableCell>
              <TableCell className="truncate px-4 py-3 align-top text-muted-foreground">
                {row.provider ?? <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="truncate px-4 py-3 align-top">
                {FREQUENCY_LABELS[row.frequency]}
              </TableCell>
              <TableCell className="truncate px-4 py-3 align-top">
                {row.property ? (
                  PROPERTY_LABELS[row.property]
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="truncate px-4 py-3 align-top">
                {row.next_due_at ? (
                  formatDateTime(row.next_due_at, timeZone)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="truncate px-4 py-3 align-top text-muted-foreground">
                {row.reminder_lead_days.length > 0
                  ? `${row.reminder_lead_days.length} ${
                      row.reminder_lead_days.length === 1 ? 'alert' : 'alerts'
                    }`
                  : '—'}
              </TableCell>
              <TableCell className="truncate px-4 py-3 align-top text-muted-foreground">
                {row.reminder_recipients.length > 0
                  ? `${row.reminder_recipients.length} ${
                      row.reminder_recipients.length === 1 ? 'person' : 'people'
                    }`
                  : '—'}
              </TableCell>
              <TableCell className="truncate px-4 py-3 align-top">
                {row.assigned_to ? (
                  (userLabelById[row.assigned_to] ?? '—')
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </TableCell>
              <TableCell className="px-4 py-3 align-top">
                {row.active ? (
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline">Ended</Badge>
                )}
              </TableCell>
            </RecurringRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function SortIndicator({
  active,
  dir,
}: {
  active: boolean
  dir?: SortDirection
}) {
  if (active && dir === 'asc') {
    return (
      <RiArrowUpSLine
        className="size-4 shrink-0 text-foreground"
        aria-hidden="true"
      />
    )
  }
  if (active && dir === 'desc') {
    return (
      <RiArrowDownSLine
        className="size-4 shrink-0 text-foreground"
        aria-hidden="true"
      />
    )
  }
  // Unsorted: a muted hint that the column is sortable, emphasized on hover.
  return (
    <RiExpandUpDownLine
      className="size-4 shrink-0 text-muted-foreground/40 group-hover/sort:text-muted-foreground"
      aria-hidden="true"
    />
  )
}
