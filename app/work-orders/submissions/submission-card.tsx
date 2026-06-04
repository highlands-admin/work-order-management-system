'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { FormError } from '@/components/auth/form-error'
import { SubmitButton } from '@/components/auth/submit-button'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { useServerErrors } from '@/lib/hooks/use-server-errors'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  PROPERTY_LABELS,
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
} from '@/lib/schemas/work-order'
import { cn } from '@/lib/utils'

import { initialAuthState } from '../../(auth)/auth-state'
import {
  approveWorkOrderAction,
  rejectWorkOrderAction,
} from '../actions'

type SubmissionStatus = 'pending' | 'rejected'

export type SubmissionCardWorkOrder = {
  id: string
  workOrderCode: string
  title: string
  status: SubmissionStatus
  category: WorkOrderCategory
  priority: WorkOrderPriority
  property: Property | null
  unitNumber: string | null
  description: string
  dueAt: string | null
  reporterName: string | null
  reporterEmail: string | null
  reporterPhone: string | null
  createdAt: string
  rejectedReason: string | null
  rejectedAt: string | null
}

const PRIORITY_DOT: Record<WorkOrderPriority, string> = {
  urgent: 'bg-rose-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-zinc-400',
}

const PRIORITY_TEXT: Record<WorkOrderPriority, string> = {
  urgent: 'text-rose-700 dark:text-rose-400',
  high: 'text-orange-700 dark:text-orange-400',
  medium: 'text-amber-700 dark:text-amber-500',
  low: 'text-zinc-600 dark:text-zinc-400',
}

export function SubmissionCard({
  workOrder,
  canModerate,
}: {
  workOrder: SubmissionCardWorkOrder
  canModerate: boolean
}) {
  const isRejected = workOrder.status === 'rejected'

  // Hooks must run unconditionally even when the moderator UI is hidden, so
  // the rules of hooks aren't violated when canModerate flips between rows.
  const [showReject, setShowReject] = useState(false)
  const boundApprove = approveWorkOrderAction.bind(null, workOrder.id)
  const [approveState, approveAction] = useActionState(
    boundApprove,
    initialAuthState
  )
  const boundReject = rejectWorkOrderAction.bind(null, workOrder.id)
  const [rejectState, rejectAction] = useActionState(
    boundReject,
    initialAuthState
  )
  const { markEdited, getError } = useServerErrors(
    rejectState,
    rejectState.fieldErrors
  )
  const reasonError = getError('reason')

  const propertyLine = workOrder.property
    ? workOrder.unitNumber
      ? `${PROPERTY_LABELS[workOrder.property]} · Unit ${workOrder.unitNumber}`
      : PROPERTY_LABELS[workOrder.property]
    : null
  const hasReporter =
    workOrder.reporterName || workOrder.reporterEmail || workOrder.reporterPhone

  return (
    <article
      className={cn(
        'rounded-lg border bg-card p-6 transition-colors hover:border-foreground/20',
        isRejected && 'opacity-95'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium tabular-nums text-muted-foreground">
            {workOrder.workOrderCode}
          </span>
          <span className="text-muted-foreground/40" aria-hidden="true">
            •
          </span>
          <span
            className={cn(
              'size-2 shrink-0 rounded-full',
              PRIORITY_DOT[workOrder.priority]
            )}
            aria-hidden="true"
          />
          <span
            className={cn(
              'font-semibold tracking-wide',
              PRIORITY_TEXT[workOrder.priority]
            )}
          >
            {PRIORITY_LABELS[workOrder.priority]}
          </span>
          <span className="text-muted-foreground/40" aria-hidden="true">
            •
          </span>
          <span className="text-muted-foreground">
            {CATEGORY_LABELS[workOrder.category]}
          </span>
          {isRejected ? (
            <span className="ml-1 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Rejected
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
          <time
            className="text-muted-foreground tabular-nums"
            dateTime={isRejected ? workOrder.rejectedAt ?? workOrder.createdAt : workOrder.createdAt}
            title={formatExactDateTime(
              isRejected ? workOrder.rejectedAt ?? workOrder.createdAt : workOrder.createdAt
            )}
          >
            {isRejected
              ? `Rejected ${formatRelativeTime(workOrder.rejectedAt ?? workOrder.createdAt)}`
              : `Submitted ${formatRelativeTime(workOrder.createdAt)}`}
          </time>
          <Link
            href={`/work-orders/${workOrder.id}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            View details
          </Link>
        </div>
      </div>

      <h3 className="mt-5 font-heading text-base font-semibold tracking-tight">
        {workOrder.title}
      </h3>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground/90">
        {workOrder.description}
      </p>

      {propertyLine || workOrder.dueAt || hasReporter || isRejected ? (
        <dl className="mt-6 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
          {propertyLine ? (
            <DetailRow label="Location">{propertyLine}</DetailRow>
          ) : null}
          {workOrder.dueAt ? (
            <DetailRow label="Due">
              {formatExactDateTime(workOrder.dueAt)}
            </DetailRow>
          ) : null}
          {hasReporter ? (
            <DetailRow label="Reporter">
              {workOrder.reporterName ? (
                <div className="text-foreground">{workOrder.reporterName}</div>
              ) : null}
              {workOrder.reporterEmail || workOrder.reporterPhone ? (
                <div
                  className={cn(
                    'flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground',
                    workOrder.reporterName ? 'mt-0.5' : null
                  )}
                >
                  {workOrder.reporterEmail ? (
                    <a
                      href={`mailto:${workOrder.reporterEmail}`}
                      className="hover:text-foreground"
                    >
                      {workOrder.reporterEmail}
                    </a>
                  ) : null}
                  {workOrder.reporterEmail && workOrder.reporterPhone ? (
                    <span aria-hidden="true">·</span>
                  ) : null}
                  {workOrder.reporterPhone ? (
                    <a
                      href={`tel:${workOrder.reporterPhone}`}
                      className="hover:text-foreground"
                    >
                      {workOrder.reporterPhone}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </DetailRow>
          ) : null}
          {isRejected && workOrder.rejectedReason ? (
            <DetailRow label="Reason">
              <p className="whitespace-pre-line text-foreground/90">
                {workOrder.rejectedReason}
              </p>
            </DetailRow>
          ) : null}
        </dl>
      ) : null}

      {!isRejected ? (
        <div className="mt-6 border-t pt-5">
          {approveState.status === 'error' && approveState.message ? (
            <p className="mb-3 text-sm text-destructive">
              {approveState.message}
            </p>
          ) : null}

          {canModerate ? (
            showReject ? (
              <form
                action={rejectAction}
                noValidate
                className="flex flex-col gap-3"
              >
                <FormError state={rejectState} />
                <FieldGroup>
                  <Field data-invalid={reasonError ? 'true' : undefined}>
                    <FieldLabel htmlFor={`reason-${workOrder.id}`}>
                      Reason for rejection
                    </FieldLabel>
                    <Textarea
                      id={`reason-${workOrder.id}`}
                      name="reason"
                      rows={3}
                      defaultValue={rejectState.values?.reason}
                      onChange={() => markEdited('reason')}
                      aria-invalid={reasonError ? true : undefined}
                      placeholder="Tell the creator what needs to change."
                      required
                    />
                    <FieldError>{reasonError}</FieldError>
                  </Field>
                </FieldGroup>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowReject(false)}
                  >
                    Cancel
                  </Button>
                  <SubmitButton
                    label="Confirm rejection"
                    pendingLabel="Rejecting..."
                  />
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReject(true)}
                >
                  Reject
                </Button>
                <form action={approveAction}>
                  <SubmitButton label="Approve" pendingLabel="Approving..." />
                </form>
              </div>
            )
          ) : (
            <p className="text-xs text-muted-foreground">
              Awaiting administrator review.
            </p>
          )}
        </div>
      ) : null}
    </article>
  )
}

function DetailRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <>
      <dt className="pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-foreground">{children}</dd>
    </>
  )
}

function formatExactDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatRelativeTime(value: string): string {
  const then = new Date(value).getTime()
  const now = Date.now()
  const diffSec = Math.max(0, Math.round((now - then) / 1000))

  if (diffSec < 60) return 'just now'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return formatExactDateTime(value)
}
