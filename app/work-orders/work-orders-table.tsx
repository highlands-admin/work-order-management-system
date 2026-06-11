'use client'

import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiExpandUpDownLine,
} from '@remixicon/react'
import { useEffect, useMemo, useState, type PointerEvent } from 'react'

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
} from '@/components/ui/table'
import {
  PriorityBadge,
  StatusBadge,
} from '@/components/work-orders/work-order-badge'
import { formatDate, formatDateTime } from '@/lib/datetime/format'
import {
  CATEGORY_LABELS,
  PROPERTY_LABELS,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'

import { WorkOrderRow } from './work-order-row'

export type WorkOrderListItem = {
  id: string
  work_order_code: string
  title: string
  category: WorkOrderCategory
  status: WorkOrderStatus
  property: Property | null
  assigned_to: string | null
  priority: WorkOrderPriority
  due_at: string | null
  reported_by_name: string | null
  created_at: string
}

type Column = {
  key: string
  label: string
  width: number
}

// Default column widths in pixels. Users can drag the handles to resize.
const COLUMNS: Column[] = [
  { key: 'code', label: 'ID', width: 120 },
  { key: 'title', label: 'Title', width: 200 },
  { key: 'category', label: 'Category', width: 130 },
  { key: 'status', label: 'Status', width: 120 },
  { key: 'priority', label: 'Priority', width: 130 },
  { key: 'property', label: 'Property', width: 130 },
  { key: 'created', label: 'Created', width: 120 },
  { key: 'due', label: 'Due', width: 180 },
  { key: 'assignee', label: 'Assignee', width: 160 },
  { key: 'reporter', label: 'Reported by', width: 180 },
]

const MIN_WIDTH = 60

type SortDirection = 'asc' | 'desc'
type SortState = { key: string; dir: SortDirection }

// Extracts the comparable value for each column. Enum columns sort by their
// canonical order (workflow progression for status, urgency for priority)
// rather than alphabetically; text columns are lower-cased for a stable,
// case-insensitive sort. Nullable columns return null and are pushed to the
// end regardless of direction.
const SORT_VALUE: Record<
  string,
  (wo: WorkOrderListItem) => number | string | null
> = {
  code: (wo) => Number.parseInt(wo.work_order_code.replace(/\D/g, ''), 10),
  title: (wo) => wo.title.toLowerCase(),
  created: (wo) => new Date(wo.created_at).getTime(),
  category: (wo) => CATEGORY_LABELS[wo.category].toLowerCase(),
  status: (wo) => WORK_ORDER_STATUSES.indexOf(wo.status),
  priority: (wo) => WORK_ORDER_PRIORITIES.indexOf(wo.priority),
  property: (wo) => (wo.property ? PROPERTY_LABELS[wo.property].toLowerCase() : null),
  due: (wo) => (wo.due_at ? new Date(wo.due_at).getTime() : null),
  reporter: (wo) => wo.reported_by_name?.toLowerCase() ?? null,
}

function compareValues(
  a: number | string,
  b: number | string
): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

type ResizeState = {
  index: number
  startX: number
  startWidth: number
}

export function WorkOrdersTable({
  workOrders,
  emptyMessage,
  userLabelById,
  timeZone,
}: {
  workOrders: WorkOrderListItem[]
  emptyMessage: string
  userLabelById: Record<string, string>
  timeZone: string
}) {
  // The assignee label lives outside the row, so resolve it here.
  function assigneeLabel(assignedTo: string | null): string | null {
    if (!assignedTo) return null
    return userLabelById[assignedTo] ?? assignedTo.slice(0, 8)
  }
  const [widths, setWidths] = useState<number[]>(() =>
    COLUMNS.map((c) => c.width)
  )
  const [resizing, setResizing] = useState<ResizeState | null>(null)
  const [sort, setSort] = useState<SortState | null>(null)

  // Sort the already-loaded rows on the client. The list is capped server-side,
  // so this stays cheap and feels instant. Nulls always sort last; the
  // ascending order is inverted for descending while keeping nulls at the end.
  const sortedWorkOrders = useMemo(() => {
    if (!sort) return workOrders
    const getValue = (wo: WorkOrderListItem): number | string | null => {
      if (sort.key === 'assignee') {
        return wo.assigned_to
          ? (userLabelById[wo.assigned_to] ?? wo.assigned_to).toLowerCase()
          : null
      }
      return SORT_VALUE[sort.key](wo)
    }
    return [...workOrders].sort((a, b) => {
      const av = getValue(a)
      const bv = getValue(b)
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      const result = compareValues(av, bv)
      return sort.dir === 'asc' ? result : -result
    })
  }, [workOrders, sort, userLabelById])

  // Cycle a column through ascending, descending, then unsorted.
  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  // While a drag is active, track the pointer on the window so the cursor can
  // leave the narrow handle without dropping the resize. Subscribing here (and
  // tearing down on release) is the supported effect pattern; setWidths runs
  // inside the event callback, not the effect body.
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

  if (workOrders.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <p className="p-6 text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  const totalWidth = widths.reduce((sum, w) => sum + w, 0)

  return (
    <div
      className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
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
                aria-sort={
                  sort?.key === col.key
                    ? sort.dir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
                className="relative h-10 select-none px-4 text-left align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                <button
                  type="button"
                  onClick={() => toggleSort(col.key)}
                  className="group/sort flex w-full items-center gap-1 pr-2 text-left uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="truncate">{col.label}</span>
                  <SortIndicator
                    active={sort?.key === col.key}
                    dir={sort?.key === col.key ? sort.dir : undefined}
                  />
                </button>
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
          {sortedWorkOrders.map((wo) => (
            <WorkOrderRow key={wo.id} href={`/work-orders/${wo.id}`}>
              <TableCell className="truncate px-4 py-3 font-medium tabular-nums text-muted-foreground">
                {wo.work_order_code}
              </TableCell>
              <TableCell className="truncate px-4 py-3 font-medium">
                {wo.title}
              </TableCell>
              <TableCell className="truncate px-4 py-3">
                {CATEGORY_LABELS[wo.category]}
              </TableCell>
              <TableCell className="truncate px-4 py-3">
                <StatusBadge status={wo.status} />
              </TableCell>
              <TableCell className="truncate px-4 py-3">
                <PriorityBadge priority={wo.priority} />
              </TableCell>
              <TableCell className="truncate px-4 py-3">
                {wo.property ? PROPERTY_LABELS[wo.property] : '—'}
              </TableCell>
              <TableCell className="truncate px-4 py-3 text-muted-foreground">
                {formatDate(wo.created_at, timeZone)}
              </TableCell>
              <TableCell className="truncate px-4 py-3 text-muted-foreground">
                {wo.due_at ? formatDateTime(wo.due_at, timeZone) : '—'}
              </TableCell>
              <TableCell className="truncate px-4 py-3 text-muted-foreground">
                {wo.assigned_to ? (
                  assigneeLabel(wo.assigned_to)
                ) : (
                  <span className="text-muted-foreground/70">Unassigned</span>
                )}
              </TableCell>
              <TableCell className="truncate px-4 py-3 text-muted-foreground">
                {wo.reported_by_name ?? '—'}
              </TableCell>
            </WorkOrderRow>
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
    return <RiArrowUpSLine className="size-4 shrink-0 text-foreground" aria-hidden="true" />
  }
  if (active && dir === 'desc') {
    return <RiArrowDownSLine className="size-4 shrink-0 text-foreground" aria-hidden="true" />
  }
  // Unsorted: a muted hint that the column is sortable, emphasized on hover.
  return (
    <RiExpandUpDownLine
      className="size-4 shrink-0 text-muted-foreground/40 group-hover/sort:text-muted-foreground"
      aria-hidden="true"
    />
  )
}

