'use client'

import { RiArrowDownSLine, RiCloseLine, RiInboxLine } from '@remixicon/react'
import { memo, useCallback, useMemo, useState } from 'react'

import {
  MultiSelectFilter,
  type Option,
} from '@/components/ui/multi-select-filter'
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs'
import { formatDate } from '@/lib/datetime/format'
import {
  CATEGORY_LABELS,
  PROPERTIES,
  PROPERTY_LABELS,
  WORK_ORDER_CATEGORIES_BY_LABEL,
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
} from '@/lib/schemas/work-order'
import { formatLocation } from '@/lib/work-orders/location'
import { cn } from '@/lib/utils'

import { QueueDetail, type QueueBucket, type QueueEntry } from './queue-detail'

const ALL = 'all'

// A small priority dot is quieter than a badge on every row, and since the list
// is already urgency-sorted it just reinforces the grouping at a glance.
const PRIORITY_DOT: Record<WorkOrderPriority, string> = {
  urgent: 'bg-rose-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-400',
  low: 'bg-zinc-300 dark:bg-zinc-600',
}

// Urgency sections, most pressing first. Only non-empty sections render.
const BUCKET_ORDER: QueueBucket[] = ['immediate', 'soon', 'later']
const BUCKET_LABELS: Record<QueueBucket, string> = {
  immediate: 'Needs Immediate Attention',
  soon: 'Due This Week',
  later: 'Due Later',
}

export function SubmissionQueue({
  pending,
  canModerate,
  timeZone,
}: {
  pending: QueueEntry[]
  canModerate: boolean
  timeZone: string
}) {
  const [active, setActive] = useState<string>(ALL)
  const [facilities, setFacilities] = useState<Property[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Stable identities so memoized rows don't all re-render on every toggle; a
  // click then only re-renders the two rows whose expanded state changed, so the
  // animation starts instantly instead of behind a full-list reconcile.
  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])
  const handleDone = useCallback(() => setExpandedId(null), [])

  // Only offer facilities that actually have something pending, so the filter
  // never lists a choice that empties the queue.
  const facilityOptions = useMemo(() => facilityOptionsFor(pending), [pending])

  // Facility narrows the pool before the category tabs read it, so the tab
  // counts describe what a tab would actually show under the active filter.
  const scoped =
    facilities.length === 0
      ? pending
      : pending.filter(
          (item) => item.property !== null && facilities.includes(item.property)
        )

  const byCategory = countByCategory(scoped)
  const list =
    active === ALL ? scoped : scoped.filter((item) => item.category === active)

  const emptyMessage =
    pending.length === 0
      ? canModerate
        ? 'Nothing to review right now.'
        : 'No submissions awaiting review.'
      : facilities.length > 0
        ? 'No pending work orders match these filters.'
        : `No ${CATEGORY_LABELS[active as WorkOrderCategory]} work orders pending.`

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={active} onValueChange={(value) => setActive(String(value))}>
        <TabsList>
          <TabsTab value={ALL}>
            All
            <TabCount>{scoped.length}</TabCount>
          </TabsTab>
          {WORK_ORDER_CATEGORIES_BY_LABEL.map((category) => (
            <TabsTab key={category} value={category}>
              {CATEGORY_LABELS[category]}
              <TabCount>{byCategory[category] ?? 0}</TabCount>
            </TabsTab>
          ))}
        </TabsList>
      </Tabs>

      {/* One facility means the filter can only be a no-op, so it stays hidden
          until the queue actually spans more than one. */}
      {facilityOptions.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <MultiSelectFilter
            label="Facility"
            options={facilityOptions}
            selected={facilities}
            onChange={setFacilities}
          />
          {facilities.map((property) => (
            <button
              key={property}
              type="button"
              onClick={() =>
                setFacilities((prev) => prev.filter((v) => v !== property))
              }
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
            >
              {PROPERTY_LABELS[property]}
              <RiCloseLine className="size-3.5 opacity-60" aria-hidden="true" />
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
        </div>
      ) : null}

      {list.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div className="flex flex-col gap-6">
          {BUCKET_ORDER.map((bucket) => {
            const items = list.filter((item) => item.bucket === bucket)
            if (items.length === 0) return null
            return (
              <section key={bucket} className="flex flex-col gap-2">
                <SectionHeading
                  label={BUCKET_LABELS[bucket]}
                  count={items.length}
                  urgent={bucket === 'immediate'}
                />
                <ul className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
                  {items.map((item) => (
                    <QueueListRow
                      key={item.id}
                      item={item}
                      expanded={expandedId === item.id}
                      canModerate={canModerate}
                      timeZone={timeZone}
                      onToggle={handleToggle}
                      onDone={handleDone}
                    />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

const QueueListRow = memo(function QueueListRow({
  item,
  expanded,
  canModerate,
  timeZone,
  onToggle,
  onDone,
}: {
  item: QueueEntry
  expanded: boolean
  canModerate: boolean
  timeZone: string
  onToggle: (id: string) => void
  onDone: () => void
}) {
  // Facility leads the meta line and carries a little more weight than the rest
  // of it: it's the first thing a reviewer scans for, and on narrow screens the
  // line truncates from the right, so it stays visible.
  const facility = formatLocation(item.property, item.unitNumber)
  const requester =
    item.reporterName ?? item.reporterEmail ?? item.reporterPhone
  const meta = [
    requester,
    item.dueAt ? `Due ${formatDate(item.dueAt, timeZone)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li>
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        aria-expanded={expanded}
        className={cn(
          'flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-muted/50',
          expanded && 'bg-muted/40'
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'mt-1.5 size-2 shrink-0 rounded-full',
            PRIORITY_DOT[item.priority]
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.title}</p>
          {facility || meta ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {facility ? (
                <span className="font-medium text-foreground/80">
                  {facility}
                </span>
              ) : null}
              {facility && meta ? ' · ' : null}
              {meta}
            </p>
          ) : null}
        </div>
        <RiArrowDownSLine
          className={cn(
            'mt-0.5 size-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 motion-reduce:transition-none',
            expanded && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>
      <AccordionPanel open={expanded}>
        <QueueDetail
          item={item}
          canModerate={canModerate}
          timeZone={timeZone}
          onDone={onDone}
        />
      </AccordionPanel>
    </li>
  )
})

// Animates height between collapsed and expanded using the grid-template-rows
// 0fr -> 1fr trick, so it eases smoothly to the content's natural height with no
// JS measurement. The content stays mounted for both directions to animate;
// `inert` keeps the collapsed panel out of tab order and the accessibility tree.
function AccordionPanel({
  open,
  children,
}: {
  open: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      )}
    >
      <div
        className={cn(
          'overflow-hidden transition-opacity duration-300 ease-out motion-reduce:transition-none',
          open ? 'opacity-100' : 'opacity-0'
        )}
        inert={!open}
      >
        {children}
      </div>
    </div>
  )
}

function SectionHeading({
  label,
  count,
  urgent,
}: {
  label: string
  count: number
  urgent: boolean
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <h3
        className={cn(
          'font-heading text-[0.9375rem] font-bold',
          urgent ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
        )}
      >
        {label}
      </h3>
      <span
        className={cn(
          'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
          urgent
            ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {count}
      </span>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <RiInboxLine className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function TabCount({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground/10 px-1 text-[0.6875rem] font-medium leading-none tabular-nums text-muted-foreground">
      {children}
    </span>
  )
}

// Facilities represented in the queue, in the canonical PROPERTIES order rather
// than the order they happen to appear in the list.
function facilityOptionsFor(items: QueueEntry[]): Option<Property>[] {
  const present = new Set<Property>()
  for (const item of items) {
    if (item.property) present.add(item.property)
  }
  return PROPERTIES.filter((property) => present.has(property)).map(
    (property) => ({ value: property, label: PROPERTY_LABELS[property] })
  )
}

function countByCategory(
  items: QueueEntry[]
): Partial<Record<WorkOrderCategory, number>> {
  const counts: Partial<Record<WorkOrderCategory, number>> = {}
  for (const item of items) {
    counts[item.category] = (counts[item.category] ?? 0) + 1
  }
  return counts
}
