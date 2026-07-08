'use client'

import { RiEqualizerLine, RiLoader4Line } from '@remixicon/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { MultiSelectFilter } from '@/components/ui/multi-select-filter'
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
  CATEGORY_LABELS,
  WORK_ORDER_CATEGORIES,
  type WorkOrderCategory,
} from '@/lib/schemas/work-order'
import { writeDashboardCategoryCookie } from '@/lib/work-orders/dashboard-filters-cookie'

const OPTIONS = [...WORK_ORDER_CATEGORIES]
  .map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))
  .sort((a, b) => a.label.localeCompare(b.label))

// Scopes every chart and KPI tile on the dashboard to a subset of categories
// -- e.g. an IT admin who only wants to see IT tickets. Mirrors FilterBar's
// "Filters" button + Sheet drawer + staged draft + Apply pattern from the
// work-order list pages, kept to a single Category facet for now but built
// the same way so another facet (e.g. Facility) can be added the same way
// FilterBar adds one: another MultiSelectFilter line in the panel body.
export function DashboardCategoryFilter({
  selected,
}: {
  selected: WorkOrderCategory[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Staged copy edited inside the panel. Nothing reaches the dashboard until
  // "Apply"; opening the panel re-syncs the draft to whatever is applied, so
  // closing without applying discards the edits.
  const [draft, setDraft] = useState<WorkOrderCategory[]>(selected)

  function commit(next: WorkOrderCategory[]) {
    writeDashboardCategoryCookie(next)
    const params = new URLSearchParams(searchParams.toString())
    // Always set (even empty) so a cleared filter reads as "explicitly none"
    // rather than "never touched" -- see DASHBOARD_CATEGORY_COOKIE.
    params.set('category', next.join(','))
    const query = params.toString()
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      })
    })
  }

  const filterBadge =
    selected.length > 0 ? (
      <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-medium text-background">
        {selected.length}
      </span>
    ) : null

  function renderBody() {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <MultiSelectFilter
          label="Category"
          options={OPTIONS}
          selected={draft}
          onChange={setDraft}
        />
      </div>
    )
  }

  function renderFooter() {
    return (
      <SheetFooter className="border-t">
        <div className="flex items-center gap-2">
          {draft.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setDraft([])}
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
