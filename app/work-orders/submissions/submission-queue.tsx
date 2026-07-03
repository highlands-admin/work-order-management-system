'use client'

import { RiArrowDownSLine, RiInboxLine } from '@remixicon/react'
import { useState } from 'react'

import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs'
import { formatDate } from '@/lib/datetime/format'
import {
  CATEGORY_LABELS,
  WORK_ORDER_CATEGORIES_BY_LABEL,
  type WorkOrderCategory,
  type WorkOrderPriority,
} from '@/lib/schemas/work-order'
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
  later: 'Backlog',
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
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const byCategory = countByCategory(pending)
  const list =
    active === ALL
      ? pending
      : pending.filter((item) => item.category === active)

  const emptyMessage =
    pending.length === 0
      ? canModerate
        ? 'Nothing to review right now.'
        : 'No submissions awaiting review.'
      : `No ${CATEGORY_LABELS[active as WorkOrderCategory]} work orders pending.`

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={active} onValueChange={(value) => setActive(String(value))}>
        <TabsList>
          <TabsTab value={ALL}>
            All
            <TabCount>{pending.length}</TabCount>
          </TabsTab>
          {WORK_ORDER_CATEGORIES_BY_LABEL.map((category) => (
            <TabsTab key={category} value={category}>
              {CATEGORY_LABELS[category]}
              <TabCount>{byCategory[category] ?? 0}</TabCount>
            </TabsTab>
          ))}
        </TabsList>
      </Tabs>

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
                      onToggle={() =>
                        setExpandedId((prev) =>
                          prev === item.id ? null : item.id
                        )
                      }
                      onDone={() => setExpandedId(null)}
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

function QueueListRow({
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
  onToggle: () => void
  onDone: () => void
}) {
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
        onClick={onToggle}
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
          {meta ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
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
}

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
          'overflow-hidden transition-opacity duration-200 motion-reduce:transition-none',
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
          'text-sm font-semibold',
          urgent ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
        )}
      >
        {label}
      </h3>
      <span className="text-xs tabular-nums text-muted-foreground/60">
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

function countByCategory(
  items: QueueEntry[]
): Partial<Record<WorkOrderCategory, number>> {
  const counts: Partial<Record<WorkOrderCategory, number>> = {}
  for (const item of items) {
    counts[item.category] = (counts[item.category] ?? 0) + 1
  }
  return counts
}
