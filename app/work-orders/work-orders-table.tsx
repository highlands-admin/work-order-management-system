'use client'

import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiExpandUpDownLine,
  RiRepeatLine,
} from '@remixicon/react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react'

import { Badge } from '@/components/ui/badge'
import { Table, TableCell, TableHeader } from '@/components/ui/table'
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
  CATEGORY_OPTIONS,
  PRIORITY_OPTIONS,
  PROPERTY_OPTIONS,
  STATUS_OPTIONS,
} from '@/lib/work-orders/filter-options'
import {
  UNASSIGNED,
  hasFilterParams,
  parseWorkOrderFilters,
  toSearchParams,
  withFilter,
  type WorkOrderFilters,
} from '@/lib/work-orders/filters'
import { WORK_ORDERS_WIDTHS_COOKIE, writeWidthsCookie } from '@/lib/work-orders/list-column-widths-cookie'
import {
  filtersCookieForPath,
  writeFilterCookie,
} from '@/lib/work-orders/list-filters-cookie'
import {
  isSortable,
  type ListSort,
  type SortDirection,
} from '@/lib/work-orders/list-sort'
import {
  ARCHIVE_SORT_COOKIE,
  MINE_SORT_COOKIE,
  SORT_COOKIE,
  writeSortCookie,
} from '@/lib/work-orders/list-sort-cookie'

import { buildLabeledSnippet } from '@/lib/work-orders/search-snippet'

import { DateRangeFilter } from './date-range-filter'
import { MatchSnippet } from './match-snippet'
import { TablePagination } from './table-pagination'
import { WorkOrderRowGroup } from './work-order-row'
import {
  ColumnFilterTrigger,
  MultiSelectFilter,
  type Option,
} from '@/components/ui/multi-select-filter'

// This table is shared across three lists; each remembers its own sort
// independently, keyed off which one is currently rendering it. Column widths
// are NOT split the same way -- all three render the identical column set, so
// one shared preference (see WORK_ORDERS_WIDTHS_COOKIE) is what a user expects.
function sortCookieForPath(pathname: string): string {
  if (pathname.startsWith('/work-orders/mine')) return MINE_SORT_COOKIE
  if (pathname.startsWith('/work-orders/rejected')) return ARCHIVE_SORT_COOKIE
  return SORT_COOKIE
}

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
  // Fetched only when a search is active, to show why each row matched. The
  // individual fields let the snippet be labeled with where the match was; the
  // blob (own fields + note bodies) is the fallback that also covers notes.
  description?: string | null
  unit_number?: string | null
  search_text?: string | null
}

type Column = {
  key: string
  label: string
  width: number
}

// Default column widths in pixels. Users can drag the handles to resize.
// Filterable columns (category/status/priority/property/assignee/created/due)
// are a bit wider than their label alone needs, to comfortably fit the sort
// and filter icons alongside it without crowding.
const COLUMNS: Column[] = [
  { key: 'code', label: 'ID', width: 120 },
  { key: 'title', label: 'Title', width: 200 },
  { key: 'category', label: 'Category', width: 160 },
  { key: 'status', label: 'Status', width: 150 },
  { key: 'priority', label: 'Priority', width: 150 },
  { key: 'property', label: 'Facility', width: 150 },
  { key: 'created', label: 'Created', width: 150 },
  { key: 'due', label: 'Due', width: 190 },
  { key: 'assignee', label: 'Assignee', width: 200 },
  { key: 'reporter', label: 'Reported by', width: 180 },
]

// Absolute floor for any column. Columns with sort and filter icons compute a
// larger minimum at drag time (see measureHeaderMinWidth) so a contraction
// never clips their icons.
const MIN_WIDTH = 60

// Measure the smallest width a column may contract to, from the header cell the
// resize handle lives in. The content cluster (label + sort + filter icons) is
// a block-level flex row, so it stretches to fill the column: its own width is
// useless as a minimum. Its children are nowrap and shrink-0 and pack left, so
// the intrinsic content width is the span from the cluster's left edge to the
// rightmost child's right edge. Add the cell's horizontal padding and a small
// buffer so the last icon never sits under the resize handle.
function measureHeaderMinWidth(handle: HTMLElement): number {
  const cell = handle.closest('th')
  const cluster = cell?.querySelector<HTMLElement>('[data-header-content]')
  if (!cell || !cluster) return MIN_WIDTH
  const clusterLeft = cluster.getBoundingClientRect().left
  let contentRight = clusterLeft
  for (const child of cluster.children) {
    const right = child.getBoundingClientRect().right
    if (right > contentRight) contentRight = right
  }
  const contentWidth = contentRight - clusterLeft
  const style = getComputedStyle(cell)
  const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
  const handleBuffer = 8
  return Math.max(MIN_WIDTH, Math.ceil(contentWidth + padding + handleBuffer))
}

// Keyed by column key rather than index, so a resize survives a column being
// conditionally hidden (My Work Orders omits Assignee, Archive omits Status).
type ResizeState = {
  key: string
  startX: number
  startWidth: number
  // Smallest width this column may contract to. Measured from the header's
  // content cluster so the label, sort icon, and filter icon stay visible.
  minWidth: number
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
  initialColumnWidths,
  assigneeOptions = [],
  initialFilters,
  highlight,
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
  // Server-resolved persisted widths, keyed by column key. Passed down (rather
  // than read from the cookie on the client) so the first client render
  // already matches the server-rendered markup -- no post-hydration snap.
  initialColumnWidths?: Record<string, number>
  // Powers the Assignee column's per-column filter icon. Omitted (and that
  // filter icon hidden) on views that don't already build this list for the
  // Filters panel.
  assigneeOptions?: Option<string>[]
  // The server-resolved effective filters for the first render: the URL's, or
  // a persisted cookie's when the URL carries none (see FilterBar's identical
  // prop). Without this, the column filter icons read straight from the
  // (possibly still-bare) URL and show as inactive even when a cookie-restored
  // filter is already applied to the data.
  initialFilters?: WorkOrderFilters
  // The active, sanitized search term. When set, each matching row shows a
  // highlighted excerpt of where the term was found (title, notes, and so on).
  highlight?: string
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

  // Per-column filter icons (Notion-style): commit straight back to the URL,
  // the same cookie + navigation FilterBar uses, so both entry points into
  // filtering stay in sync automatically. Derived fresh every render rather
  // than held in state: once the URL carries any filter param, it's always
  // the source of truth (no separate local copy to fall out of sync when
  // something else, like a FilterBar chip removal, changes it); only a
  // completely bare URL falls back to initialFilters, since that's the one
  // case the URL can't speak for itself -- see the prop doc above.
  const rawParams = useMemo(
    () => Object.fromEntries(searchParams.entries()),
    [searchParams]
  )
  const filters = hasFilterParams(rawParams)
    ? parseWorkOrderFilters(searchParams)
    : (initialFilters ?? parseWorkOrderFilters(searchParams))

  const assigneeFilterOptions: Option<string>[] = [
    { value: UNASSIGNED, label: 'Unassigned' },
    ...assigneeOptions,
  ]

  function commitFilter(next: WorkOrderFilters) {
    const query = toSearchParams(next).toString()
    writeFilterCookie(filtersCookieForPath(pathname), query)
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  function renderColumnFilter(key: string) {
    switch (key) {
      case 'category':
        return (
          <MultiSelectFilter
            label="Category"
            options={CATEGORY_OPTIONS}
            selected={filters.categories}
            onChange={(v) => commitFilter(withFilter(filters, 'categories', v))}
            trigger={
              <ColumnFilterTrigger
                label="Category"
                active={filters.categories.length > 0}
              />
            }
          />
        )
      case 'status':
        return (
          <MultiSelectFilter
            label="Status"
            options={STATUS_OPTIONS}
            selected={filters.statuses}
            onChange={(v) => commitFilter(withFilter(filters, 'statuses', v))}
            trigger={
              <ColumnFilterTrigger
                label="Status"
                active={filters.statuses.length > 0}
              />
            }
          />
        )
      case 'priority':
        return (
          <MultiSelectFilter
            label="Priority"
            options={PRIORITY_OPTIONS}
            selected={filters.priorities}
            onChange={(v) => commitFilter(withFilter(filters, 'priorities', v))}
            trigger={
              <ColumnFilterTrigger
                label="Priority"
                active={filters.priorities.length > 0}
              />
            }
          />
        )
      case 'property':
        return (
          <MultiSelectFilter
            label="Facility"
            options={PROPERTY_OPTIONS}
            selected={filters.properties}
            onChange={(v) => commitFilter(withFilter(filters, 'properties', v))}
            trigger={
              <ColumnFilterTrigger
                label="Facility"
                active={filters.properties.length > 0}
              />
            }
          />
        )
      case 'assignee':
        return (
          <MultiSelectFilter
            label="Assignee"
            options={assigneeFilterOptions}
            selected={filters.assignees}
            onChange={(v) => commitFilter(withFilter(filters, 'assignees', v))}
            trigger={
              <ColumnFilterTrigger
                label="Assignee"
                active={filters.assignees.length > 0}
              />
            }
          />
        )
      case 'created':
        return (
          <DateRangeFilter
            label="Created"
            from={filters.createdFrom}
            to={filters.createdTo}
            onChange={({ from, to }) =>
              commitFilter({ ...filters, createdFrom: from, createdTo: to })
            }
            trigger={
              <ColumnFilterTrigger
                label="Created"
                active={Boolean(filters.createdFrom || filters.createdTo)}
              />
            }
          />
        )
      case 'due':
        return (
          <DateRangeFilter
            label="Due date"
            from={filters.dueFrom}
            to={filters.dueTo}
            onChange={({ from, to }) =>
              commitFilter({ ...filters, dueFrom: from, dueTo: to })
            }
            trigger={
              <ColumnFilterTrigger
                label="Due date"
                active={Boolean(filters.dueFrom || filters.dueTo)}
              />
            }
          />
        )
      default:
        return null
    }
  }
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    for (const c of columns) initial[c.key] = initialColumnWidths?.[c.key] ?? c.width
    return initial
  })
  // Read inside the resize-end handler, which runs in an event listener set up
  // by an effect that doesn't depend on `widths` -- without the ref, it would
  // close over the width from when the drag started, not the latest one.
  const widthsRef = useRef(widths)
  useEffect(() => {
    widthsRef.current = widths
  }, [widths])
  const [resizing, setResizing] = useState<ResizeState | null>(null)

  // Sorting is server-side: cycle a column ascending -> descending -> default
  // (newest first), reset to the first page, and let the URL drive the query.
  // Persisted the same way as the filters: remember the choice (including an
  // explicit reset to default) so returning via a plain navigation restores it
  // instead of resetting.
  function toggleSort(key: string) {
    if (!isSortable(key)) return
    let nextDir: SortDirection | null
    if (sort?.key !== key) nextDir = 'asc'
    else if (sort.dir === 'asc') nextDir = 'desc'
    else nextDir = null

    writeSortCookie(
      sortCookieForPath(pathname),
      nextDir === null ? null : { key, dir: nextDir }
    )

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
      const nextWidth = Math.max(resizing!.minWidth, resizing!.startWidth + delta)
      setWidths((prev) => ({ ...prev, [resizing!.key]: nextWidth }))
    }

    function onUp() {
      setResizing(null)
      writeWidthsCookie(WORK_ORDERS_WIDTHS_COOKIE, widthsRef.current)
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
    setResizing({
      key,
      startX: event.clientX,
      startWidth: widths[key],
      minWidth: measureHeaderMinWidth(event.currentTarget),
    })
  }

  if (workOrders.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 shadow-md dark:shadow-none">
        <p className="p-6 text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  const totalWidth = columns.reduce((sum, c) => sum + widths[c.key], 0)

  return (
    <div className="flex max-w-full flex-col gap-4" style={{ width: totalWidth }}>
      <div
        className="w-full overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 shadow-md dark:shadow-none"
        style={resizing ? { userSelect: 'none', cursor: 'col-resize' } : undefined}
      >
      <Table
        // Each work order is its own <tbody> group; strip the divider under the
        // very last row so it doesn't double the container's bottom edge.
        className="table-fixed [&_tbody:last-child_tr:last-child]:border-0"
        style={{ width: totalWidth }}
      >
        <colgroup>
          {columns.map((col) => (
            <col key={col.key} style={{ width: widths[col.key] }} />
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
                  {/* A tight cluster (label + sort + filter), left-aligned and
                      sized to its own content -- not stretched to fill the
                      column -- so the filter icon reads as part of the same
                      title group instead of drifting toward the resize handle. */}
                  <div data-header-content className="flex items-center gap-1">
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="group/sort flex shrink-0 items-center gap-1 text-left uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <span className="whitespace-nowrap">{col.label}</span>
                        <SortIndicator
                          active={active}
                          dir={active ? sort?.dir : undefined}
                        />
                      </button>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1 uppercase tracking-wide">
                        <span className="whitespace-nowrap">{col.label}</span>
                      </span>
                    )}
                    {renderColumnFilter(col.key)}
                  </div>
                  {i < columns.length - 1 ? (
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
        {workOrders.map((wo) => {
            // Prefer the fields a viewer can't already see in a column, so the
            // snippet explains the match rather than repeating a visible cell.
            const match = highlight
              ? buildLabeledSnippet(
                  [
                    { label: 'Description', text: wo.description },
                    { label: 'Title', text: wo.title },
                    { label: 'Reported by', text: wo.reported_by_name },
                    { label: 'Unit', text: wo.unit_number },
                    { label: 'ID', text: wo.work_order_code },
                  ],
                  { label: 'Notes', text: wo.search_text },
                  highlight
                )
              : null
            return (
            <WorkOrderRowGroup
              key={wo.id}
              href={`/work-orders/${wo.id}`}
              colSpan={columns.length}
              excerpt={match ? <MatchSnippet match={match} /> : undefined}
            >
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
            </WorkOrderRowGroup>
            )
          })}
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

