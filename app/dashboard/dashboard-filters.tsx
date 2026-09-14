'use client'

import { RiEqualizerLine, RiLoader4Line } from '@remixicon/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import {
  MultiSelectFilter,
  type Option,
} from '@/components/ui/multi-select-filter'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  ALL_STATUS_OPTIONS,
  CATEGORY_OPTIONS,
  PRIORITY_OPTIONS,
  PROPERTY_OPTIONS,
} from '@/lib/work-orders/filter-options'
import {
  EMPTY_FILTERS,
  SOURCE_LABELS,
  toSearchParams,
  UNASSIGNED,
  withFilter,
  WORK_ORDER_SOURCES,
  type WorkOrderFilters,
  type WorkOrderSource,
} from '@/lib/work-orders/filters'
import {
  DASHBOARD_FILTERS_COOKIE,
  writeFilterCookie,
} from '@/lib/work-orders/list-filters-cookie'

const SOURCE_OPTIONS: Option<WorkOrderSource>[] = WORK_ORDER_SOURCES.map((v) => ({
  value: v,
  label: SOURCE_LABELS[v],
}))

// Scopes every chart and KPI tile on the dashboard through the same facets the
// work order lists use -- facility, assignee, status, priority, category,
// source, and the created and due date ranges -- so a question asked of the
// list can be asked of the dashboard in the same words.
//
// It keeps its own compact panel rather than reusing FilterBar: the dashboard
// header has room for one button, not a toolbar, and Export and Print belong to
// a table rather than to a page of charts. The facet controls and the option
// lists are the shared ones, so the two stay in step.
export function DashboardFilters({
  selected,
  assigneeOptions = [],
}: {
  selected: WorkOrderFilters
  assigneeOptions?: Option<string>[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // "Unassigned" is always offered, ahead of the user list, matching FilterBar.
  const assigneeFilterOptions = useMemo<Option<string>[]>(
    () => [{ value: UNASSIGNED, label: 'Unassigned' }, ...assigneeOptions],
    [assigneeOptions]
  )

  // Staged copy edited inside the panel. Nothing reaches the dashboard until
  // "Apply"; opening the panel re-syncs the draft to whatever is applied, so
  // closing without applying discards the edits.
  const [draft, setDraft] = useState<WorkOrderFilters>(selected)

  function commit(next: WorkOrderFilters) {
    const query = toSearchParams(next).toString()
    // Written before the navigation so the server cannot read a stale cookie
    // while resolving the request this commit is about to make.
    writeFilterCookie(DASHBOARD_FILTERS_COOKIE, query)

    // The range selector's choice is not a filter, so it survives a filter
    // change: keep it and replace everything else with the new filter state.
    const params = new URLSearchParams(query)
    const range = searchParams.get('range')
    if (range) params.set('range', range)

    const search = params.toString()
    startTransition(() => {
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      })
    })
  }

  // Count of active facets, shown as a badge on the "Filters" button. Each date
  // range counts once however many of its two bounds are set.
  const activeFilterCount =
    selected.statuses.length +
    selected.priorities.length +
    selected.categories.length +
    selected.properties.length +
    selected.sources.length +
    selected.assignees.length +
    (selected.dueFrom || selected.dueTo ? 1 : 0) +
    (selected.createdFrom || selected.createdTo ? 1 : 0)

  const filterBadge =
    activeFilterCount > 0 ? (
      <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-medium text-background">
        {activeFilterCount}
      </span>
    ) : null

  // Same facets in the same order as the work order list's panel, so the two
  // read as one control in two places.
  function renderBody() {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <MultiSelectFilter
          label="Assignee"
          options={assigneeFilterOptions}
          selected={draft.assignees}
          onChange={(v) => setDraft((d) => withFilter(d, 'assignees', v))}
        />
        <MultiSelectFilter
          label="Category"
          options={CATEGORY_OPTIONS}
          selected={draft.categories}
          onChange={(v) => setDraft((d) => withFilter(d, 'categories', v))}
        />
        <DateRangeFilter
          label="Created"
          from={draft.createdFrom}
          to={draft.createdTo}
          onChange={({ from, to }) =>
            setDraft((d) => ({ ...d, createdFrom: from, createdTo: to }))
          }
        />
        <DateRangeFilter
          label="Due date"
          from={draft.dueFrom}
          to={draft.dueTo}
          onChange={({ from, to }) =>
            setDraft((d) => ({ ...d, dueFrom: from, dueTo: to }))
          }
        />
        <MultiSelectFilter
          label="Facility"
          options={PROPERTY_OPTIONS}
          selected={draft.properties}
          onChange={(v) => setDraft((d) => withFilter(d, 'properties', v))}
        />
        <MultiSelectFilter
          label="Priority"
          options={PRIORITY_OPTIONS}
          selected={draft.priorities}
          onChange={(v) => setDraft((d) => withFilter(d, 'priorities', v))}
        />
        <MultiSelectFilter
          label="Source"
          options={SOURCE_OPTIONS}
          selected={draft.sources}
          onChange={(v) => setDraft((d) => withFilter(d, 'sources', v))}
        />
        <MultiSelectFilter
          label="Status"
          options={ALL_STATUS_OPTIONS}
          selected={draft.statuses}
          onChange={(v) => setDraft((d) => withFilter(d, 'statuses', v))}
        />
      </div>
    )
  }

  function renderFooter() {
    // Clearing keeps the search term, which the dashboard has no input for and
    // only ever inherits from a link.
    const draftActive =
      toSearchParams({ ...draft, q: '' }).toString().length > 0

    return (
      <SheetFooter className="border-t">
        <div className="flex items-center gap-2">
          {draftActive ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setDraft({ ...EMPTY_FILTERS, q: draft.q })}
            >
              Clear all
            </Button>
          ) : null}
          <SheetClose
            render={
              <Button
                type="button"
                className="flex-1"
                onClick={() => commit(draft)}
              >
                Apply
              </Button>
            }
          />
        </div>
      </SheetFooter>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {isPending ? (
        <span
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          aria-live="polite"
        >
          <RiLoader4Line className="size-3.5 animate-spin" aria-hidden="true" />
          Updating
        </span>
      ) : null}

      {/* Mobile: filters in a bottom sheet. */}
      <Sheet onOpenChange={(open) => open && setDraft(selected)}>
        <SheetTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 sm:hidden"
            >
              <RiEqualizerLine className="size-4" />
              Filters
              {filterBadge}
            </Button>
          }
        />
        <SheetContent side="bottom" className="max-h-[85vh] gap-0 rounded-t-xl">
          <SheetHeader className="border-b">
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          {renderBody()}
          {renderFooter()}
        </SheetContent>
      </Sheet>

      {/* Desktop: the same filters in a right-side drawer. */}
      <Sheet onOpenChange={(open) => open && setDraft(selected)}>
        <SheetTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden h-9 shrink-0 sm:inline-flex"
            >
              <RiEqualizerLine className="size-4" />
              Filters
              {filterBadge}
            </Button>
          }
        />
        <SheetContent side="right" className="gap-0 sm:max-w-sm">
          <SheetHeader className="border-b">
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          {renderBody()}
          {renderFooter()}
        </SheetContent>
      </Sheet>
    </div>
  )
}
