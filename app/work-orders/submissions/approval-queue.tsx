'use client'

import { RiInboxLine } from '@remixicon/react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import {
  CATEGORY_LABELS,
  WORK_ORDER_CATEGORIES,
  type WorkOrderCategory,
} from '@/lib/schemas/work-order'

import { SubmissionCard, type SubmissionCardWorkOrder } from './submission-card'

const ALL = 'all'

export function ApprovalQueue({
  pending,
  rejected,
  canModerate,
  timeZone,
}: {
  pending: SubmissionCardWorkOrder[]
  rejected: SubmissionCardWorkOrder[]
  canModerate: boolean
  timeZone: string
}) {
  const [active, setActive] = useState<string>(ALL)

  // Every category gets a tab, in the schema's canonical order, even with zero
  // pending items so reviewers can see the whole picture. Each tab counts only
  // its pending work, and an empty category shows a clear message.
  const pendingByCategory = countByCategory(pending)
  const allEmptyMessage = canModerate
    ? 'Nothing to review right now.'
    : 'No submissions awaiting review.'

  return (
    <Tabs value={active} onValueChange={(value) => setActive(String(value))}>
      <TabsList>
        <TabsTab value={ALL}>
          All
          <TabCount>{pending.length}</TabCount>
        </TabsTab>
        {WORK_ORDER_CATEGORIES.map((category) => (
          <TabsTab key={category} value={category}>
            {CATEGORY_LABELS[category]}
            <TabCount>{pendingByCategory[category] ?? 0}</TabCount>
          </TabsTab>
        ))}
      </TabsList>

      <TabsPanel value={ALL}>
        <QueueSections
          pending={pending}
          rejected={rejected}
          canModerate={canModerate}
          timeZone={timeZone}
          emptyMessage={allEmptyMessage}
        />
      </TabsPanel>
      {WORK_ORDER_CATEGORIES.map((category) => (
        <TabsPanel key={category} value={category}>
          <QueueSections
            pending={pending.filter((wo) => wo.category === category)}
            rejected={rejected.filter((wo) => wo.category === category)}
            canModerate={canModerate}
            timeZone={timeZone}
            emptyMessage={
              canModerate
                ? `You're all caught up! No ${CATEGORY_LABELS[category]} work orders need your approval right now.`
                : `You have no ${CATEGORY_LABELS[category]} work orders awaiting approval.`
            }
          />
        </TabsPanel>
      ))}
    </Tabs>
  )
}

function QueueSections({
  pending,
  rejected,
  canModerate,
  timeZone,
  emptyMessage,
}: {
  pending: SubmissionCardWorkOrder[]
  rejected: SubmissionCardWorkOrder[]
  canModerate: boolean
  timeZone: string
  emptyMessage: string
}) {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <SectionHeading title="Pending review" count={pending.length} />
        {pending.length === 0 ? (
          <EmptyState message={emptyMessage} />
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            {pending.map((wo) => (
              <SubmissionCard
                key={wo.id}
                workOrder={wo}
                canModerate={canModerate}
                timeZone={timeZone}
              />
            ))}
          </div>
        )}
      </section>

      {rejected.length > 0 ? (
        <section className="flex flex-col gap-4">
          <SectionHeading title="Recently rejected" count={rejected.length} />
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            {rejected.map((wo) => (
              <SubmissionCard
                key={wo.id}
                workOrder={wo}
                canModerate={canModerate}
                timeZone={timeZone}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <Badge variant="secondary" className="tabular-nums">
        {count}
      </Badge>
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
  items: SubmissionCardWorkOrder[]
): Partial<Record<WorkOrderCategory, number>> {
  const counts: Partial<Record<WorkOrderCategory, number>> = {}
  for (const item of items) {
    counts[item.category] = (counts[item.category] ?? 0) + 1
  }
  return counts
}
