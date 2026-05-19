'use client'

import { RiCloseLine, RiLoader4Line, RiSearchLine } from '@remixicon/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'

import { Input } from '@/components/ui/input'
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
  withFilter,
  type WorkOrderFilters,
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

export function FilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

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

  function commit(next: WorkOrderFilters) {
    setFilters(next)
    const query = toSearchParams(next).toString()
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      })
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={filters.q} onChange={(q) => commit(withFilter(filters, 'q', q))} />

        <MultiSelectFilter
          label="Status"
          options={STATUS_OPTIONS}
          selected={filters.statuses}
          onChange={(v) => commit(withFilter(filters, 'statuses', v))}
        />
        <MultiSelectFilter
          label="Priority"
          options={PRIORITY_OPTIONS}
          selected={filters.priorities}
          onChange={(v) => commit(withFilter(filters, 'priorities', v))}
        />
        <MultiSelectFilter
          label="Category"
          options={CATEGORY_OPTIONS}
          selected={filters.categories}
          onChange={(v) => commit(withFilter(filters, 'categories', v))}
        />
        <MultiSelectFilter
          label="Property"
          options={PROPERTY_OPTIONS}
          selected={filters.properties}
          onChange={(v) => commit(withFilter(filters, 'properties', v))}
        />

        <DateRangeFilter
          label="Due date"
          from={filters.dueFrom}
          to={filters.dueTo}
          onChange={({ from, to }) =>
            commit({ ...filters, dueFrom: from, dueTo: to })
          }
        />
        <DateRangeFilter
          label="Created"
          from={filters.createdFrom}
          to={filters.createdTo}
          onChange={({ from, to }) =>
            commit({ ...filters, createdFrom: from, createdTo: to })
          }
        />

        <div className="ml-auto flex items-center gap-3">
          {isPending ? (
            <span
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              aria-live="polite"
            >
              <RiLoader4Line className="size-3.5 animate-spin" aria-hidden="true" />
              Updating
            </span>
          ) : null}
          {hasActiveFilters(filters) ? (
            <button
              type="button"
              onClick={() => commit(EMPTY_FILTERS)}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Clear all
            </button>
          ) : null}
        </div>
      </div>

      <ActiveFilterChips
        filters={filters}
        onChange={commit}
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
    <div className="relative">
      <RiSearchLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-9 w-72 max-w-full pl-8"
        aria-label="Search work orders"
      />
    </div>
  )
}

function ActiveFilterChips({
  filters,
  onChange,
}: {
  filters: WorkOrderFilters
  onChange: (next: WorkOrderFilters) => void
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
