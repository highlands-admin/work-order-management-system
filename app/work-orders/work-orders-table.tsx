'use client'

import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiExpandUpDownLine,
  RiRepeatLine,
} from '@remixicon/react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, type PointerEvent } from 'react'

import { Badge } from '@/components/ui/badge'
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
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'
import { cn } from '@/lib/utils'
import {
  isSortable,
  type ListSort,
  type SortDirection,
} from '@/lib/work-orders/list-sort'

import { TablePagination } from './table-pagination'
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
  recurring_work_order_id: string | null
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
  { key: 'property', label: 'Facility', width: 130 },
  { key: 'created', label: 'Created', width: 120 },
  { key: 'due', label: 'Due', width: 180 },
  { key: 'assignee', label: 'Assignee', width: 160 },
  { key: 'reporter', label: 'Reported by', width: 180 },
]

const MIN_WIDTH = 60

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
  sort,
  showAssignee = true,
  showStatus = true,
  pagination,
}: {
  workOrders: WorkOrderListItem[]
  emptyMessage: string
  userLabelById: Record<string, string>
  timeZone: string
  sort: ListSort | null
  showAssignee?: boolean
  // The Archive lists only rejected work orders, so the Status column carries
  // no information and is hidden there.
  showStatus?: boolean
  // Rendered inside the table's width container so the page/prev/next controls
  // align to the table's right edge instead of the page's.
  pagination?: { page: number; pageSize: number; total: number }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // The "My Work Orders" table omits the assignee column (every row is the
  // viewer's), and the Archive omits the status column (every row is rejected).
  const columns = COLUMNS.filter(
    (c) =>
      (showAssignee || c.key !== 'assignee') &&
      (showStatus || c.key !== 'status')
  )

  // The assignee label lives outside the row, so resolve it here.
  function assigneeLabel(assignedTo: string | null): string | null {
    if (!assignedTo) return null
    return userLabelById[assignedTo] ?? assignedTo.slice(0, 8)
  }
  const [widths, setWidths] = useState<number[]>(() =>
    columns.map((c) => c.width)
  )
  const [resizing, setResizing] = useState<ResizeState | null>(null)

  // Sorting is server-side: cycle a column ascending -> descending -> default
  // (newest first), reset to the first page, and let the URL drive the query.
  function toggleSort(key: string) {
    if (!isSortable(key)) return
    let nextDir: SortDirection | null
    if (sort?.key !== key) nextDir = 'asc'
    else if (sort.dir === 'asc') nextDir = 'desc'
    else nextDir = null

    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
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
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 shadow-md dark:shadow-none">
        <p className="p-6 text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  const totalWidth = widths.reduce((sum, w) => sum + w, 0)

  return (
    <div className="flex max-w-full flex-col gap-4" style={{ width: totalWidth }}>
      <div
        className="w-full overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 shadow-md dark:shadow-none"
        style={resizing ? { userSelect: 'none', cursor: 'col-resize' } : undefined}
      >
      <Table className="table-fixed" style={{ width: totalWidth }}>
        <colgroup>
          {columns.map((col, i) => (
            <col key={col.key} style={{ width: widths[i] }} />
          ))}
        </colgroup>
        <TableHeader>
          <tr className="border-b bg-muted/40">
            {columns.map((col, i) => {
              const sortable = isSortable(col.key)
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
                    <span className="flex w-full items-center gap-1 pr-2 uppercase tracking-wide">
                      <span className="truncate">{col.label}</span>
                    </span>
                  )}
                  {i < columns.length - 1 ? (
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
              )
            })}
          </tr>
        </TableHeader>
        <TableBody>
          {workOrders.map((wo) => (
            <WorkOrderRow key={wo.id} href={`/work-orders/${wo.id}`}>
              <TableCell className="truncate px-4 py-3 font-medium tabular-nums text-muted-foreground">
                {wo.work_order_code}
              </TableCell>
              <TableCell className="px-4 py-3 font-medium">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate">{wo.title}</span>
                  {wo.recurring_work_order_id ? (
                    <Link
                      href="/work-orders/recurring"
                      title="Generated from a recurring schedule"
                      className="shrink-0"
                    >
                      <Badge
                        variant="outline"
                        className="gap-1 text-muted-foreground"
                      >
                        <RiRepeatLine className="size-3" aria-hidden="true" />
                        Recurring
                      </Badge>
                    </Link>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="truncate px-4 py-3">
                {CATEGORY_LABELS[wo.category]}
              </TableCell>
              {showStatus ? (
                <TableCell className="truncate px-4 py-3">
                  <StatusBadge status={wo.status} />
                </TableCell>
              ) : null}
              <TableCell className="truncate px-4 py-3">
                <PriorityBadge priority={wo.priority} />
              </TableCell>
              <TableCell className="truncate px-4 py-3">
                {wo.property ? PROPERTY_LABELS[wo.property] : '—'}
              </TableCell>
              <TableCell className="truncate px-4 py-3 text-muted-foreground">
                {formatDate(wo.created_at, timeZone)}
              </TableCell>
              <TableCell
                suppressHydrationWarning
                className={cn(
                  'truncate px-4 py-3',
                  isOverdue(wo.due_at, wo.status)
                    ? 'font-medium text-destructive'
                    : 'text-muted-foreground'
                )}
              >
                {wo.due_at ? formatDateTime(wo.due_at, timeZone) : '—'}
              </TableCell>
              {showAssignee ? (
                <TableCell className="truncate px-4 py-3 text-muted-foreground">
                  {wo.assigned_to ? (
                    assigneeLabel(wo.assigned_to)
                  ) : (
                    <span className="text-muted-foreground/70">Unassigned</span>
                  )}
                </TableCell>
              ) : null}
              <TableCell className="truncate px-4 py-3 text-muted-foreground">
                {wo.reported_by_name ?? '—'}
              </TableCell>
            </WorkOrderRow>
          ))}
        </TableBody>
      </Table>
      </div>
      {pagination ? (
        <TablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
        />
      ) : null}
    </div>
  )
}

// A work order is overdue when its due date has passed and it is still open or
// in progress; done and closed work is never overdue. The clock read lives in
// this helper so it isn't flagged as an impure call during render.
function isOverdue(dueAt: string | null, status: WorkOrderStatus): boolean {
  if (!dueAt) return false
  if (status !== 'open' && status !== 'in_progress') return false
  return new Date(dueAt).getTime() < Date.now()
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

