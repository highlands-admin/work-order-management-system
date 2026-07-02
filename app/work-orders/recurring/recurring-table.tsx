'use client'

import { useEffect, useState, type PointerEvent } from 'react'

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

type ResizeState = {
  index: number
  startX: number
  startWidth: number
}

export function RecurringTable({
  schedules,
  userLabelById,
  timeZone,
}: {
  schedules: RecurringTableRow[]
  userLabelById: Record<string, string>
  timeZone: string
}) {
  const [widths, setWidths] = useState<number[]>(() =>
    COLUMNS.map((c) => c.width)
  )
  const [resizing, setResizing] = useState<ResizeState | null>(null)

  // Track the pointer on the window during a drag so it can leave the narrow
  // handle without dropping the resize. Same pattern as the work orders table.
  useEffect(() => {
    if (!resizing) return

    function onMove(event: globalThis.PointerEvent) {
      const delta = event.clientX - resizing!.startX
      const nextWidth = Math.max(MIN_WIDTH, resizing!.startWidth + delta)
      setWidths((prev) => {
        const next = [...prev]
        next[resizing!.index] = nextWidth
        return next
      })
    }

    function onUp() {
      setResizing(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [resizing])

  function startResize(index: number, event: PointerEvent<HTMLSpanElement>) {
    event.preventDefault()
    setResizing({ index, startX: event.clientX, startWidth: widths[index] })
  }

  const totalWidth = widths.reduce((sum, w) => sum + w, 0)

  return (
    <div
      className="w-fit max-w-full overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 shadow-md dark:shadow-none"
      style={resizing ? { userSelect: 'none', cursor: 'col-resize' } : undefined}
    >
      <Table className="table-fixed" style={{ width: totalWidth }}>
        <colgroup>
          {COLUMNS.map((col, i) => (
            <col key={col.key} style={{ width: widths[i] }} />
          ))}
        </colgroup>
        <TableHeader>
          <tr className="border-b bg-muted/40">
            {COLUMNS.map((col, i) => (
              <th
                key={col.key}
                className="relative h-10 select-none px-4 text-left align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                <span className="truncate">{col.label}</span>
                {i < COLUMNS.length - 1 ? (
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Resize ${col.label} column`}
                    onPointerDown={(e) => startResize(i, e)}
                    className="absolute right-0 top-0 z-10 flex h-full w-2 cursor-col-resize touch-none items-stretch justify-center hover:bg-border/70 active:bg-border"
                  >
                    <span className="my-2 w-px bg-border" aria-hidden="true" />
                  </span>
                ) : null}
              </th>
            ))}
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
