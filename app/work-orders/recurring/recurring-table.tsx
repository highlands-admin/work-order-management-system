'use client'

import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiExpandUpDownLine,
} from '@remixicon/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'

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
import { UNASSIGNED } from '@/lib/work-orders/filters'
import { CATEGORY_OPTIONS, PROPERTY_OPTIONS } from '@/lib/work-orders/filter-options'
import {
  RECURRING_WIDTHS_COOKIE,
  writeWidthsCookie,
} from '@/lib/work-orders/list-column-widths-cookie'
import {
  RECURRING_FILTERS_COOKIE,
  writeFilterCookie,
} from '@/lib/work-orders/list-filters-cookie'
import {
  RECURRING_SORT_COOKIE,
  writeSortCookie,
} from '@/lib/work-orders/list-sort-cookie'
import {
  hasRecurringFilterParams,
  parseRecurringFilters,
  RECURRING_PARAM,
  toRecurringSearchParams,
  type RecurringFilters,
} from '@/lib/work-orders/recurring-filters'
import {
  isRecurringSortable,
  type RecurringSort,
  type SortDirection,
} from '@/lib/work-orders/recurring-sort'

import { FREQUENCY_OPTIONS } from './recurring-filter-bar'
import { RecurringRow } from './recurring-row'
import {
  ColumnFilterTrigger,
  MultiSelectFilter,
  type Option,
} from '@/components/ui/multi-select-filter'

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

// Default column widths in pixels. Users drag the handles to resize, matching
// the main work orders table. Filterable columns (category/property/
// frequency/assignee) are a bit wider than their label alone needs, to
// comfortably fit the sort and filter icons alongside it without crowding.
const COLUMNS = [
  { key: 'title', label: 'Title', width: 200 },
  { key: 'category', label: 'Category', width: 200 },
  { key: 'provider', label: 'Provider', width: 160 },
  { key: 'frequency', label: 'Frequency', width: 175 },
  { key: 'property', label: 'Facility', width: 185 },
  { key: 'due', label: 'Next due', width: 180 },
  { key: 'alerts', label: 'Alerts', width: 110 },
  { key: 'recipients', label: 'Recipients', width: 120 },
  { key: 'assignee', label: 'Assignee', width: 200 },
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
  assigneeOptions = [],
  initialFilters,
}: {
  schedules: RecurringTableRow[]
  userLabelById: Record<string, string>
  timeZone: string
  sort: RecurringSort | null
  // Server-resolved persisted widths, keyed by column key -- see the same prop
  // on WorkOrdersTable for why this is passed down rather than read from the
  // cookie on the client.
  initialColumnWidths?: Record<string, number>
  // Powers the Assignee column's per-column filter icon. Omitted (and that
  // filter icon hidden) on views that don't already build this list for the
  // Filters panel.
  assigneeOptions?: Option<string>[]
  // The server-resolved effective filters for the first render: the URL's, or
  // a persisted cookie's when the URL carries none (see the identical prop on
  // RecurringFilterBar). Without this, the column filter icons read straight
  // from the (possibly still-bare) URL and show as inactive even when a
  // cookie-restored filter is already applied to the data.
  initialFilters?: RecurringFilters
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [widths, setWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    for (const c of COLUMNS) initial[c.key] = initialColumnWidths?.[c.key] ?? c.width
    return initial
  })

  // Per-column filter icons (Notion-style): commit straight back to the URL,
  // the same cookie + navigation RecurringFilterBar uses, so both entry points
  // stay in sync automatically. Derived fresh every render rather than held in
  // state -- see the identical pattern (and why) on WorkOrdersTable.
  const rawParams = useMemo(
    () => Object.fromEntries(searchParams.entries()),
    [searchParams]
  )
  const filters = hasRecurringFilterParams(rawParams)
    ? parseRecurringFilters(searchParams)
    : (initialFilters ?? parseRecurringFilters(searchParams))

  const assigneeFilterOptions: Option<string>[] = [
    { value: UNASSIGNED, label: 'Unassigned' },
    ...assigneeOptions,
  ]

  // Set the filter params from `next`, preserving everything else in the URL
  // (view, sort, dir) -- matching RecurringFilterBar's own commit.
  function commitFilter(next: RecurringFilters) {
    const params = new URLSearchParams(searchParams.toString())
    for (const key of Object.values(RECURRING_PARAM)) params.delete(key)
    toRecurringSearchParams(next).forEach((value, key) => {
      params.set(key, value)
    })
    writeFilterCookie(
      RECURRING_FILTERS_COOKIE,
      toRecurringSearchParams(next).toString()
    )
    const query = params.toString()
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
            onChange={(v) =>
              commitFilter({ ...filters, categories: v })
            }
            trigger={
              <ColumnFilterTrigger
                label="Category"
                active={filters.categories.length > 0}
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
            onChange={(v) =>
              commitFilter({ ...filters, properties: v })
            }
            trigger={
              <ColumnFilterTrigger
                label="Facility"
                active={filters.properties.length > 0}
              />
            }
          />
        )
      case 'frequency':
        return (
          <MultiSelectFilter
            label="Frequency"
            options={FREQUENCY_OPTIONS}
            selected={filters.frequencies}
            onChange={(v) =>
              commitFilter({ ...filters, frequencies: v })
            }
            trigger={
              <ColumnFilterTrigger
                label="Frequency"
                active={filters.frequencies.length > 0}
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
            onChange={(v) =>
              commitFilter({ ...filters, assignees: v })
            }
            trigger={
              <ColumnFilterTrigger
                label="Assignee"
                active={filters.assignees.length > 0}
              />
            }
          />
        )
      default:
        return null
    }
  }
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
                  {/* A tight cluster (label + sort + filter), left-aligned and
                      sized to its own content -- not stretched to fill the
                      column -- so the filter icon reads as part of the same
                      title group instead of drifting toward the resize handle. */}
                  <div className="flex items-center gap-1">
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
                      <span className="flex shrink-0 items-center gap-1 whitespace-nowrap uppercase tracking-wide">
                        {col.label}
                      </span>
                    )}
                    {renderColumnFilter(col.key)}
                  </div>
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
