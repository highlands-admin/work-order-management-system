'use client'

import {
  RiCloseLine,
  RiEqualizerLine,
  RiLoader4Line,
  RiSearchLine,
} from '@remixicon/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
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
  FREQUENCY_LABELS,
  PROPERTY_LABELS,
  PROPERTIES,
  RECURRENCE_FREQUENCIES,
  WORK_ORDER_CATEGORIES_BY_LABEL,
} from '@/lib/schemas/work-order'
import { UNASSIGNED } from '@/lib/work-orders/filters'
import {
  RECURRING_FILTERS_COOKIE,
  writeFilterCookie,
} from '@/lib/work-orders/list-filters-cookie'
import {
  EMPTY_RECURRING_FILTERS,
  hasActiveRecurringFilters,
  parseRecurringFilters,
  RECURRING_PARAM,
  toRecurringSearchParams,
  type RecurringFilters,
} from '@/lib/work-orders/recurring-filters'

import { MultiSelectFilter, type Option } from '../multi-select-filter'

const CATEGORY_OPTIONS = WORK_ORDER_CATEGORIES_BY_LABEL.map((v) => ({
  value: v,
  label: CATEGORY_LABELS[v],
}))
const PROPERTY_OPTIONS = PROPERTIES.map((v) => ({
  value: v,
  label: PROPERTY_LABELS[v],
}))
const FREQUENCY_OPTIONS = RECURRENCE_FREQUENCIES.map((v) => ({
  value: v,
  label: FREQUENCY_LABELS[v],
}))

export function RecurringFilterBar({
  assigneeOptions,
  initialFilters,
}: {
  assigneeOptions: Option<string>[]
  // The server-resolved effective filters for the first render: the URL's, or
  // a persisted cookie's when the URL carries none. Seeds the optimistic state
  // so the panel and chips match what's already showing, with no URL round
  // trip.
  initialFilters?: RecurringFilters
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const urlFilters = useMemo(
    () => parseRecurringFilters(searchParams),
    [searchParams]
  )
  const urlKey = useMemo(
    () => toRecurringSearchParams(urlFilters).toString(),
    [urlFilters]
  )

  // The URL is the source of truth, but we keep an optimistic local copy
  // seeded from the server-resolved filters, so a persisted-cookie default
  // doesn't need a redirect (and its round trip) to show up correctly.
  const [filters, setFilters] = useState(initialFilters ?? urlFilters)
  const [lastSyncedUrlKey, setLastSyncedUrlKey] = useState(urlKey)

  // When the URL changes for any reason other than a commit we just made
  // (back/forward, external navigation, clearing to a bare URL), adopt the
  // URL's filters -- see the identical pattern in ../filter-bar.tsx.
  if (lastSyncedUrlKey !== urlKey) {
    setLastSyncedUrlKey(urlKey)
    const localKey = toRecurringSearchParams(filters).toString()
    if (localKey !== urlKey) {
      setFilters(urlFilters)
    }
  }

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

  // Staged copy of the filters edited inside the panel. Nothing reaches the
  // table until "Apply"; opening the panel re-syncs the draft to whatever is
  // applied, so closing without applying discards the edits.
  const [draft, setDraft] = useState(initialFilters ?? urlFilters)

  // Set the filter params from `next`, preserving everything else in the URL
  // (view, sort, dir), then navigate.
  function commit(next: RecurringFilters) {
    setFilters(next)
    const params = new URLSearchParams(searchParams.toString())
    for (const key of Object.values(RECURRING_PARAM)) params.delete(key)
    toRecurringSearchParams(next).forEach((value, key) => {
      params.set(key, value)
    })
    // Remember this list's filters (including an explicit clear-to-empty) so
    // returning via a plain navigation, e.g. another sidebar tab and back,
    // restores them instead of resetting. Must happen before the navigation
    // below, so it can't race a redirect that reads a stale cookie.
    writeFilterCookie(RECURRING_FILTERS_COOKIE, toRecurringSearchParams(next).toString())
    const query = params.toString()
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      })
    })
  }

  // Count of active facets for the badge on the "Filters" button. Search is
  // excluded because it has its own always-visible input.
  const activeFilterCount =
    filters.categories.length +
    filters.properties.length +
    filters.frequencies.length +
    filters.assignees.length

  const filterBadge =
    activeFilterCount > 0 ? (
      <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-medium text-background">
        {activeFilterCount}
      </span>
    ) : null

  function renderFilters() {
    return (
      <>
        <MultiSelectFilter
          label="Assignee"
          options={assigneeFilterOptions}
          selected={draft.assignees}
          onChange={(v) => setDraft((d) => ({ ...d, assignees: v }))}
        />
        <MultiSelectFilter
          label="Category"
          options={CATEGORY_OPTIONS}
          selected={draft.categories}
          onChange={(v) => setDraft((d) => ({ ...d, categories: v }))}
        />
        <MultiSelectFilter
          label="Facility"
          options={PROPERTY_OPTIONS}
          selected={draft.properties}
          onChange={(v) => setDraft((d) => ({ ...d, properties: v }))}
        />
        <MultiSelectFilter
          label="Frequency"
          options={FREQUENCY_OPTIONS}
          selected={draft.frequencies}
          onChange={(v) => setDraft((d) => ({ ...d, frequencies: v }))}
        />
      </>
    )
  }

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
          {hasActiveRecurringFilters(draft) ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              // Stage a reset; keep the live search term, which is edited
              // outside the panel. Applied when "Apply" is clicked.
              onClick={() =>
                setDraft((d) => ({ ...EMPTY_RECURRING_FILTERS, q: d.q }))
              }
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
          onChange={(q) => commit({ ...filters, q })}
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
          <SheetContent side="bottom" className="max-h-[85vh] gap-0 rounded-t-xl">
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

        {isPending ? (
          <span
            className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"
            aria-live="polite"
          >
            <RiLoader4Line className="size-3.5 animate-spin" aria-hidden="true" />
            Updating
          </span>
        ) : null}
        </div>
      </div>

      <ActiveFilterChips
        filters={filters}
        onChange={commit}
        assigneeLabels={assigneeLabels}
      />
    </div>
  )
}

function ActiveFilterChips({
  filters,
  onChange,
  assigneeLabels,
}: {
  filters: RecurringFilters
  onChange: (next: RecurringFilters) => void
  assigneeLabels: Record<string, string>
}) {
  const chips: { key: string; label: string; remove: () => void }[] = []

  for (const c of filters.categories) {
    chips.push({
      key: `category-${c}`,
      label: `Category: ${CATEGORY_LABELS[c]}`,
      remove: () =>
        onChange({
          ...filters,
          categories: filters.categories.filter((v) => v !== c),
        }),
    })
  }
  for (const p of filters.properties) {
    chips.push({
      key: `property-${p}`,
      label: `Facility: ${PROPERTY_LABELS[p]}`,
      remove: () =>
        onChange({
          ...filters,
          properties: filters.properties.filter((v) => v !== p),
        }),
    })
  }
  for (const f of filters.frequencies) {
    chips.push({
      key: `frequency-${f}`,
      label: `Frequency: ${FREQUENCY_LABELS[f]}`,
      remove: () =>
        onChange({
          ...filters,
          frequencies: filters.frequencies.filter((v) => v !== f),
        }),
    })
  }
  for (const a of filters.assignees) {
    chips.push({
      key: `assignee-${a}`,
      label: `Assignee: ${assigneeLabels[a] ?? 'Unknown'}`,
      remove: () =>
        onChange({
          ...filters,
          assignees: filters.assignees.filter((v) => v !== a),
        }),
    })
  }
  if (filters.q) {
    chips.push({
      key: 'q',
      label: `“${filters.q}”`,
      remove: () => onChange({ ...filters, q: '' }),
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

function SearchInput({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  // Mirror the URL value locally so typing feels instant; debounce before we
  // navigate so we don't trigger a server round-trip per keystroke. Same
  // echo-guarding as the main work order search input.
  const [draft, setDraft] = useState(value)
  const debounced = useDebouncedValue(draft, 300)
  const [lastPushed, setLastPushed] = useState(value)
  const [lastSeenUrl, setLastSeenUrl] = useState(value)

  if (lastSeenUrl !== value) {
    setLastSeenUrl(value)
    if (value !== lastPushed) {
      setLastPushed(value)
      setDraft(value)
    }
  }

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
        placeholder="Search title or provider"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-9 w-full pl-8"
        aria-label="Search recurring schedules"
      />
    </div>
  )
}
