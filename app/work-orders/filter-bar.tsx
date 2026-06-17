'use client'

import {
  RiCloseLine,
  RiDownloadLine,
  RiEqualizerLine,
  RiLoader4Line,
  RiSearchLine,
} from '@remixicon/react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  PROPERTY_LABELS,
  STATUS_LABELS,
  WORK_ORDER_CATEGORIES,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  PROPERTIES,
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  parseWorkOrderFilters,
  toSearchParams,
  UNASSIGNED,
  withFilter,
  WORK_ORDER_SOURCES,
  type WorkOrderFilters,
  type WorkOrderSource,
} from '@/lib/work-orders/filters'

import { DateRangeFilter } from './date-range-filter'
import { MultiSelectFilter, type Option } from './multi-select-filter'

// pending/rejected work orders live on /work-orders/submissions, so the
// status filter on the main list only exposes the approved-stage statuses.
const STATUS_OPTIONS: Option<WorkOrderStatus>[] = WORK_ORDER_STATUSES
  .filter((s) => s !== 'pending' && s !== 'rejected')
  .map((v) => ({ value: v, label: STATUS_LABELS[v] }))
const PRIORITY_OPTIONS: Option<WorkOrderPriority>[] =
  WORK_ORDER_PRIORITIES.map((v) => ({ value: v, label: PRIORITY_LABELS[v] }))
const CATEGORY_OPTIONS: Option<WorkOrderCategory>[] =
  WORK_ORDER_CATEGORIES.map((v) => ({ value: v, label: CATEGORY_LABELS[v] }))
const PROPERTY_OPTIONS: Option<Property>[] = PROPERTIES.map((v) => ({
  value: v,
  label: PROPERTY_LABELS[v],
}))
const SOURCE_LABELS: Record<WorkOrderSource, string> = {
  recurring: 'Recurring',
  oneoff: 'One-off',
}
const SOURCE_OPTIONS: Option<WorkOrderSource>[] = WORK_ORDER_SOURCES.map((v) => ({
  value: v,
  label: SOURCE_LABELS[v],
}))

export function FilterBar({
  assigneeOptions = [],
  showAssignee = true,
  exportPath,
}: {
  assigneeOptions?: Option<string>[]
  showAssignee?: boolean
  // When set, render an "Export CSV" link that carries the current filters so
  // the download matches the table. Omitted on views without an export route.
  exportPath?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // "Unassigned" is always offered, ahead of the user list.
  const assigneeFilterOptions = useMemo<Option<string>[]>(
    () => [{ value: UNASSIGNED, label: 'Unassigned' }, ...assigneeOptions],
    [assigneeOptions]
  )
  const assigneeLabels = useMemo(
    () =>
      Object.fromEntries(assigneeFilterOptions.map((o) => [o.value, o.label])),
    [assigneeFilterOptions]
  )

  // The URL is the source of truth for the table, but we keep an optimistic
  // local copy so the filter UI updates the instant a user clicks rather
  // than after the server round-trip. Otherwise checkbox toggles, chip
  // removals, and "Clear all" all feel laggy by the cost of a fetch.
  const urlFilters = useMemo(
    () => parseWorkOrderFilters(searchParams),
    [searchParams]
  )
  const urlKey = useMemo(
    () => toSearchParams(urlFilters).toString(),
    [urlFilters]
  )

  const [filters, setFilters] = useState(urlFilters)
  const [lastSyncedUrlKey, setLastSyncedUrlKey] = useState(urlKey)

  // Staged copy of the filters edited inside the Filters panel. Nothing reaches
  // the table until "Apply"; opening the panel re-syncs the draft to whatever
  // is currently applied, so closing without applying discards the edits.
  const [draft, setDraft] = useState(urlFilters)

  // When the URL changes for any reason other than a commit we just made
  // (back/forward, external navigation, the table page refresh re-running
  // this component), adopt the URL's filters. We skip the adopt when our
  // optimistic state already matches the URL - that's the echo of our own
  // commit and overwriting would clobber any further clicks the user has
  // queued while the navigation was in flight.
  if (lastSyncedUrlKey !== urlKey) {
    setLastSyncedUrlKey(urlKey)
    const localKey = toSearchParams(filters).toString()
    if (localKey !== urlKey) {
      setFilters(urlFilters)
    }
  }

  // Build the export URL from the optimistic filter state so the link tracks
  // the table the instant a filter changes, before the navigation lands.
  const exportHref = useMemo(() => {
    if (!exportPath) return null
    const query = toSearchParams(filters).toString()
    return query ? `${exportPath}?${query}` : exportPath
  }, [exportPath, filters])

  function commit(next: WorkOrderFilters) {
    setFilters(next)
    const query = toSearchParams(next).toString()
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      })
    })
  }

  // The filter controls, rendered inside the Filters panel. They edit the draft
  // only; the table updates when "Apply" commits the draft.
  function renderFilters() {
    return (
      <>
        <MultiSelectFilter
          label="Status"
          options={STATUS_OPTIONS}
          selected={draft.statuses}
          onChange={(v) => setDraft((d) => withFilter(d, 'statuses', v))}
        />
        <MultiSelectFilter
          label="Priority"
          options={PRIORITY_OPTIONS}
          selected={draft.priorities}
          onChange={(v) => setDraft((d) => withFilter(d, 'priorities', v))}
        />
        <MultiSelectFilter
          label="Category"
          options={CATEGORY_OPTIONS}
          selected={draft.categories}
          onChange={(v) => setDraft((d) => withFilter(d, 'categories', v))}
        />
        <MultiSelectFilter
          label="Property"
          options={PROPERTY_OPTIONS}
          selected={draft.properties}
          onChange={(v) => setDraft((d) => withFilter(d, 'properties', v))}
        />
        <MultiSelectFilter
          label="Source"
          options={SOURCE_OPTIONS}
          selected={draft.sources}
          onChange={(v) => setDraft((d) => withFilter(d, 'sources', v))}
        />
        {showAssignee ? (
          <MultiSelectFilter
            label="Assignee"
            options={assigneeFilterOptions}
            selected={draft.assignees}
            onChange={(v) => setDraft((d) => withFilter(d, 'assignees', v))}
          />
        ) : null}
        <DateRangeFilter
          label="Due date"
          from={draft.dueFrom}
          to={draft.dueTo}
          onChange={({ from, to }) =>
            setDraft((d) => ({ ...d, dueFrom: from, dueTo: to }))
          }
        />
        <DateRangeFilter
          label="Created"
          from={draft.createdFrom}
          to={draft.createdTo}
          onChange={({ from, to }) =>
            setDraft((d) => ({ ...d, createdFrom: from, createdTo: to }))
          }
        />
      </>
    )
  }

  // Count of active facets, shown as a badge on the "Filters" button. Search is
  // excluded because it has its own always-visible input.
  const activeFilterCount =
    filters.statuses.length +
    filters.priorities.length +
    filters.categories.length +
    filters.properties.length +
    filters.sources.length +
    (showAssignee ? filters.assignees.length : 0) +
    (filters.dueFrom || filters.dueTo ? 1 : 0) +
    (filters.createdFrom || filters.createdTo ? 1 : 0)

  // Export is a standalone toolbar action, never inside the filters panel.
  const exportLink = exportHref ? (
    <Link
      href={exportHref}
      prefetch={false}
      onClick={() => toast.success('Exporting work orders to CSV.')}
      className={buttonVariants({
        variant: 'outline',
        size: 'sm',
        className: 'h-9',
      })}
    >
      <RiDownloadLine className="size-4" />
      Export CSV
    </Link>
  ) : null

  const filterBadge =
    activeFilterCount > 0 ? (
      <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-medium text-background">
        {activeFilterCount}
      </span>
    ) : null

  // Body and footer shared by the mobile (bottom) and desktop (right) sheets.
  function renderFiltersBody() {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {renderFilters()}
      </div>
    )
  }

  function renderFiltersFooter() {
    return (
      <SheetFooter className="border-t">
        <div className="flex items-center gap-2">
          {hasActiveFilters(draft) ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              // Stage a reset; keep the live search term, which is edited
              // outside the panel. Applied when "Apply" is clicked.
              onClick={() => setDraft((d) => ({ ...EMPTY_FILTERS, q: d.q }))}
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
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <SearchInput
          value={filters.q}
          onChange={(q) => commit(withFilter(filters, 'q', q))}
        />

        <div className="flex items-center gap-2 sm:flex-1">
          {/* Mobile: filters in a bottom sheet. */}
          <Sheet onOpenChange={(open) => open && setDraft(filters)}>
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
            <SheetContent
              side="bottom"
              className="max-h-[85vh] gap-0 rounded-t-xl"
            >
              <SheetHeader className="border-b">
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              {renderFiltersBody()}
              {renderFiltersFooter()}
            </SheetContent>
          </Sheet>

          {/* Desktop: the same filters in a right-side drawer. */}
          <Sheet onOpenChange={(open) => open && setDraft(filters)}>
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
              {renderFiltersBody()}
              {renderFiltersFooter()}
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2 sm:ml-auto">
            {isPending ? (
              <span
                className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"
                aria-live="polite"
              >
                <RiLoader4Line
                  className="size-3.5 animate-spin"
                  aria-hidden="true"
                />
                Updating
              </span>
            ) : null}
            {exportLink}
          </div>
        </div>
      </div>

      <ActiveFilterChips
        filters={filters}
        onChange={commit}
        assigneeLabels={assigneeLabels}
        showAssignee={showAssignee}
      />
    </div>
  )
}

function SearchInput({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  // Mirror the URL value locally so typing feels instant; debounce before we
  // navigate so we don't trigger a server round-trip per keystroke.
  const [draft, setDraft] = useState(value)
  const debounced = useDebouncedValue(draft, 300)

  // Track the last value we pushed up so we can recognize the URL change
  // that came back as our own echo and ignore it. Without this, fast typing
  // races against the debounced push: the URL catches up to "abc" while
  // draft has already become "abcdef", and the prev-state sync below would
  // overwrite draft with the stale "abc".
  const [lastPushed, setLastPushed] = useState(value)
  const [lastSeenUrl, setLastSeenUrl] = useState(value)
  if (lastSeenUrl !== value) {
    setLastSeenUrl(value)
    // External change (Clear all, chip removal) - sync the input down.
    // Echoes of our own pushes are filtered out by the equality check.
    if (value !== lastPushed) {
      setLastPushed(value)
      setDraft(value)
    }
  }

  // Push the debounced draft up when it diverges from the URL and from the
  // value we last pushed (avoids re-emitting the same value on a render
  // that's only there because the URL caught up).
  useEffect(() => {
    if (debounced !== value && debounced !== lastPushed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastPushed(debounced)
      onChange(debounced)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  return (
    <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
      <RiSearchLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-9 w-full pl-8"
        aria-label="Search work orders"
      />
    </div>
  )
}

function ActiveFilterChips({
  filters,
  onChange,
  assigneeLabels,
  showAssignee,
}: {
  filters: WorkOrderFilters
  onChange: (next: WorkOrderFilters) => void
  assigneeLabels: Record<string, string>
  showAssignee: boolean
}) {
  const chips: { key: string; label: string; remove: () => void }[] = []

  for (const s of filters.statuses) {
    chips.push({
      key: `status-${s}`,
      label: `Status: ${STATUS_LABELS[s]}`,
      remove: () =>
        onChange(
          withFilter(
            filters,
            'statuses',
            filters.statuses.filter((v) => v !== s)
          )
        ),
    })
  }
  for (const p of filters.priorities) {
    chips.push({
      key: `priority-${p}`,
      label: `Priority: ${PRIORITY_LABELS[p]}`,
      remove: () =>
        onChange(
          withFilter(
            filters,
            'priorities',
            filters.priorities.filter((v) => v !== p)
          )
        ),
    })
  }
  for (const c of filters.categories) {
    chips.push({
      key: `category-${c}`,
      label: `Category: ${CATEGORY_LABELS[c]}`,
      remove: () =>
        onChange(
          withFilter(
            filters,
            'categories',
            filters.categories.filter((v) => v !== c)
          )
        ),
    })
  }
  for (const p of filters.properties) {
    chips.push({
      key: `property-${p}`,
      label: `Property: ${PROPERTY_LABELS[p]}`,
      remove: () =>
        onChange(
          withFilter(
            filters,
            'properties',
            filters.properties.filter((v) => v !== p)
          )
        ),
    })
  }
  for (const s of filters.sources) {
    chips.push({
      key: `source-${s}`,
      label: `Source: ${SOURCE_LABELS[s]}`,
      remove: () =>
        onChange(
          withFilter(
            filters,
            'sources',
            filters.sources.filter((v) => v !== s)
          )
        ),
    })
  }
  if (showAssignee) {
    for (const a of filters.assignees) {
      chips.push({
        key: `assignee-${a}`,
        label: `Assignee: ${assigneeLabels[a] ?? 'Unknown'}`,
        remove: () =>
          onChange(
            withFilter(
              filters,
              'assignees',
              filters.assignees.filter((v) => v !== a)
            )
          ),
      })
    }
  }
  if (filters.q) {
    chips.push({
      key: 'q',
      label: `“${filters.q}”`,
      remove: () => onChange(withFilter(filters, 'q', '')),
    })
  }
  if (filters.dueFrom || filters.dueTo) {
    chips.push({
      key: 'due',
      label: `Due: ${filters.dueFrom ?? '…'} → ${filters.dueTo ?? '…'}`,
      remove: () => onChange({ ...filters, dueFrom: null, dueTo: null }),
    })
  }
  if (filters.createdFrom || filters.createdTo) {
    chips.push({
      key: 'created',
      label: `Created: ${filters.createdFrom ?? '…'} → ${filters.createdTo ?? '…'}`,
      remove: () => onChange({ ...filters, createdFrom: null, createdTo: null }),
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.remove}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
        >
          {chip.label}
          <RiCloseLine className="size-3.5 opacity-60" aria-hidden="true" />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
    </div>
  )
}
