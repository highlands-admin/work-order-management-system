import { formatDateTime } from '@/lib/datetime/format'
import {
  CATEGORY_LABELS,
  MARKETING_REQUEST_TYPE_LABELS,
  MARKETING_SIZE_FORMAT_LABELS,
  MARKETING_TARGET_AUDIENCE_LABELS,
  PRIORITY_LABELS,
  PROPERTY_LABELS,
  STATUS_LABELS,
} from '@/lib/schemas/work-order'

import type { ReactNode } from 'react'

export type ActivityEvent = {
  id: string
  actor_id: string | null
  action: string
  details: Record<string, unknown>
  created_at: string
}

// Human labels for the work order columns that show up in the diff.
const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  category: 'Category',
  status: 'Status',
  priority: 'Priority',
  property: 'Property',
  unit_number: 'Unit',
  due_at: 'Due date',
  resolution: 'Resolution',
  assigned_to: 'Assignee',
  reported_by_name: 'Reporter name',
  reported_by_email: 'Reporter email',
  reported_by_phone: 'Reporter phone',
  rejected_reason: 'Rejection reason',
  rejected_at: 'Rejected at',
  rejected_by: 'Rejected by',
  marketing_request_type: 'Marketing · type of request',
  marketing_request_type_other: 'Marketing · other request type',
  marketing_event_name: 'Marketing · event name',
  marketing_target_audience: 'Marketing · target audience',
  marketing_target_audience_other: 'Marketing · other audience',
  marketing_key_message: 'Marketing · key message',
  marketing_size_format: 'Marketing · size / format',
  marketing_size_format_other: 'Marketing · other size / format',
}

// Long free-text fields: show that they changed, not a noisy full-text diff.
const LONG_FIELDS = new Set([
  'description',
  'resolution',
  'rejected_reason',
  'marketing_key_message',
])

export function ActivityFeed({
  events,
  userLabelById,
  timeZone,
}: {
  events: ActivityEvent[]
  userLabelById: Record<string, string>
  timeZone: string
}) {
  function actorName(actorId: string | null): string {
    if (!actorId) return 'System'
    return userLabelById[actorId] ?? `${actorId.slice(0, 8)}`
  }

  return (
    <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <header className="border-b bg-muted/30 px-6 py-4">
        <h2 className="font-heading text-base font-semibold tracking-tight">
          Activity
          {events.length > 0 ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({events.length})
            </span>
          ) : null}
        </h2>
      </header>

      {events.length === 0 ? (
        <p className="px-6 py-6 text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ol className="flex flex-col">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex gap-4 border-b border-foreground/5 px-6 py-5 last:border-0"
            >
              <div
                aria-hidden="true"
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
              >
                {initials(actorName(event.actor_id))}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium">{actorName(event.actor_id)}</span>
                  <span className="text-muted-foreground">
                    {actionSummary(event.action)}
                  </span>
                  <time
                    dateTime={event.created_at}
                    className="ml-auto shrink-0 pl-3 text-xs text-muted-foreground"
                  >
                    {formatDateTime(event.created_at, timeZone)}
                  </time>
                </div>
                <ActivityBody
                  event={event}
                  userLabelById={userLabelById}
                  timeZone={timeZone}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function ActivityBody({
  event,
  userLabelById,
  timeZone,
}: {
  event: ActivityEvent
  userLabelById: Record<string, string>
  timeZone: string
}) {
  if (event.action === 'updated') {
    const changes = (event.details.changes ?? {}) as Record<
      string,
      { from: unknown; to: unknown }
    >
    const entries = Object.entries(changes)
    if (entries.length === 0) return null
    return (
      <ul className="flex flex-col gap-1 text-sm text-foreground/90">
        {entries.map(([field, change]) => (
          <li key={field} className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {FIELD_LABELS[field] ?? field}
            </span>
            {LONG_FIELDS.has(field) ? (
              <span className="text-muted-foreground">updated</span>
            ) : (
              <>
                <ValueChip>
                  {formatValue(field, change.from, userLabelById, timeZone)}
                </ValueChip>
                <span aria-hidden="true" className="text-muted-foreground">
                  →
                </span>
                <ValueChip>
                  {formatValue(field, change.to, userLabelById, timeZone)}
                </ValueChip>
              </>
            )}
          </li>
        ))}
      </ul>
    )
  }

  if (event.action === 'note_added' || event.action === 'note_deleted') {
    const body = typeof event.details.body === 'string' ? event.details.body : ''
    if (!body) return null
    return <NoteQuote>{body}</NoteQuote>
  }

  if (event.action === 'note_edited') {
    const to = typeof event.details.to === 'string' ? event.details.to : ''
    if (!to) return null
    return <NoteQuote>{to}</NoteQuote>
  }

  return null
}

function ValueChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
      {children}
    </span>
  )
}

function NoteQuote({ children }: { children: string }) {
  const text = children.length > 240 ? `${children.slice(0, 240)}…` : children
  return (
    <p className="border-l-2 border-foreground/10 pl-3 text-sm whitespace-pre-line text-foreground/80">
      {text}
    </p>
  )
}

function actionSummary(action: string): string {
  switch (action) {
    case 'created':
      return 'created this work order'
    case 'updated':
      return 'updated this work order'
    case 'note_added':
      return 'added a note'
    case 'note_edited':
      return 'edited a note'
    case 'note_deleted':
      return 'deleted a note'
    default:
      return action
  }
}

function formatValue(
  field: string,
  value: unknown,
  userLabelById: Record<string, string>,
  timeZone: string
): string {
  if (value === null || value === undefined || value === '') {
    return field === 'assigned_to' ? 'Unassigned' : 'empty'
  }

  switch (field) {
    case 'status':
      return STATUS_LABELS[value as keyof typeof STATUS_LABELS] ?? String(value)
    case 'priority':
      return (
        PRIORITY_LABELS[value as keyof typeof PRIORITY_LABELS] ?? String(value)
      )
    case 'category':
      return (
        CATEGORY_LABELS[value as keyof typeof CATEGORY_LABELS] ?? String(value)
      )
    case 'property':
      return (
        PROPERTY_LABELS[value as keyof typeof PROPERTY_LABELS] ?? String(value)
      )
    case 'assigned_to':
    case 'rejected_by':
      return userLabelById[String(value)] ?? String(value).slice(0, 8)
    case 'due_at':
    case 'rejected_at':
      return formatDateTime(String(value), timeZone)
    case 'marketing_request_type':
      return (
        MARKETING_REQUEST_TYPE_LABELS[
          value as keyof typeof MARKETING_REQUEST_TYPE_LABELS
        ] ?? String(value)
      )
    case 'marketing_target_audience':
      return Array.isArray(value)
        ? value
            .map(
              (v) =>
                MARKETING_TARGET_AUDIENCE_LABELS[
                  v as keyof typeof MARKETING_TARGET_AUDIENCE_LABELS
                ] ?? String(v)
            )
            .join(', ')
        : String(value)
    case 'marketing_size_format':
      return Array.isArray(value)
        ? value
            .map(
              (v) =>
                MARKETING_SIZE_FORMAT_LABELS[
                  v as keyof typeof MARKETING_SIZE_FORMAT_LABELS
                ] ?? String(v)
            )
            .join(', ')
        : String(value)
    default:
      return String(value)
  }
}

function initials(name: string): string {
  const result = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
  return result || '?'
}
