'use client'

import {
  RiCalendarEventLine,
  RiMapPinLine,
  RiUserLine,
  type RemixiconComponentType,
} from '@remixicon/react'
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
import {
  CategoryBadge,
  PriorityBadge,
  StatusBadge,
} from '@/components/work-orders/work-order-badge'
import { formatDateTime, formatRelative } from '@/lib/datetime/format'
import { useServerErrors } from '@/lib/hooks/use-server-errors'
import {
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

export function SubmissionCard({
  workOrder,
  canModerate,
  timeZone,
}: {
  workOrder: SubmissionCardWorkOrder
  canModerate: boolean
  timeZone: string
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

  const locationLabel = workOrder.property
    ? workOrder.unitNumber
      ? `${PROPERTY_LABELS[workOrder.property]} · Unit ${workOrder.unitNumber}`
      : PROPERTY_LABELS[workOrder.property]
    : null
  const reporterLabel =
    workOrder.reporterName ?? workOrder.reporterEmail ?? workOrder.reporterPhone
  const timestamp = isRejected
    ? workOrder.rejectedAt ?? workOrder.createdAt
    : workOrder.createdAt

  return (
    <article
      className={cn(
        'relative cursor-pointer rounded-xl bg-card p-5 ring-1 ring-foreground/10',
        'transition-colors hover:ring-foreground/20 sm:p-6'
      )}
    >
      {/* Top line: the colored signal (badges) leads, the identifier sits quietly
          on the right. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {isRejected ? <StatusBadge status="rejected" /> : null}
          <PriorityBadge priority={workOrder.priority} />
          <CategoryBadge category={workOrder.category} />
        </div>
        <span className="shrink-0 pt-0.5 text-xs font-medium tabular-nums text-muted-foreground/70">
          {workOrder.workOrderCode}
        </span>
      </div>

      {/* Focal point: the title. Its ::before overlay stretches across the
          whole card so a click anywhere opens the detail page, while the action
          controls below opt back above it with z-10. */}
      <h3 className="mt-3 font-heading text-lg font-semibold leading-snug tracking-tight">
        <Link
          href={`/work-orders/${workOrder.id}`}
          className="outline-none transition-colors before:absolute before:inset-0 before:content-[''] hover:text-primary focus-visible:text-primary"
        >
          {workOrder.title}
        </Link>
      </h3>

      <p className="mt-1.5 line-clamp-3 text-sm leading-6 whitespace-pre-line text-muted-foreground">
        {workOrder.description}
      </p>

      {/* Quiet metadata row. Icons carry the meaning, so there are no shouty
          uppercase labels. */}
      {locationLabel || workOrder.dueAt || reporterLabel ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {locationLabel ? (
            <Meta icon={RiMapPinLine}>{locationLabel}</Meta>
          ) : null}
          {workOrder.dueAt ? (
            <Meta icon={RiCalendarEventLine}>
              Due {formatDateTime(workOrder.dueAt, timeZone)}
            </Meta>
          ) : null}
          {reporterLabel ? <Meta icon={RiUserLine}>{reporterLabel}</Meta> : null}
        </div>
      ) : null}

      {isRejected && workOrder.rejectedReason ? (
        <div className="mt-4 border-l-2 border-rose-300 pl-3 dark:border-rose-500/40">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Reason for rejection
          </p>
          <p className="mt-1 text-sm leading-6 whitespace-pre-line text-foreground/90">
            {workOrder.rejectedReason}
          </p>
        </div>
      ) : null}

      {/* Footer anchors the timestamp and the decision together. */}
      <div className="mt-5 border-t pt-4">
        {!isRejected && showReject ? (
          <form
            action={rejectAction}
            noValidate
            className="relative z-10 flex flex-col gap-3"
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
                size="lg"
                onClick={() => setShowReject(false)}
              >
                Cancel
              </Button>
              <SubmitButton
                label="Confirm rejection"
                pendingLabel="Rejecting..."
                size="lg"
              />
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3">
            {/* Relative phrasing depends on the current clock, the one value that
                can differ between the server render and hydration, so this opts
                out of the hydration check. */}
            <time
              className="text-xs text-muted-foreground tabular-nums"
              dateTime={timestamp}
              title={formatDateTime(timestamp, timeZone)}
              suppressHydrationWarning
            >
              {isRejected ? 'Rejected' : 'Submitted'}{' '}
              {formatRelative(timestamp, timeZone)}
            </time>

            {!isRejected ? (
              canModerate ? (
                <div className="relative z-10 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => setShowReject(true)}
                  >
                    Reject
                  </Button>
                  <form action={approveAction}>
                    <SubmitButton
                      label="Approve"
                      pendingLabel="Approving..."
                      size="lg"
                    />
                  </form>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Awaiting review
                </span>
              )
            ) : null}
          </div>
        )}

        {!isRejected &&
        !showReject &&
        approveState.status === 'error' &&
        approveState.message ? (
          <p className="mt-3 text-sm text-destructive">{approveState.message}</p>
        ) : null}
      </div>
    </article>
  )
}

function Meta({
  icon: Icon,
  children,
}: {
  icon: RemixiconComponentType
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
      <span>{children}</span>
    </span>
  )
}
