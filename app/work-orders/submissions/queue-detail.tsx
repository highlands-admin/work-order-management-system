'use client'

import {
  RiArrowRightUpLine,
  RiCalendarEventLine,
  RiMailLine,
  RiMapPinLine,
  RiPhoneLine,
  RiUserLine,
  type RemixiconComponentType,
} from '@remixicon/react'
import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { FormError } from '@/components/auth/form-error'
import { SubmitButton } from '@/components/auth/submit-button'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import {
  CategoryBadge,
  PriorityBadge,
} from '@/components/work-orders/work-order-badge'
import { formatDateTime, formatRelative } from '@/lib/datetime/format'
import { useServerErrors } from '@/lib/hooks/use-server-errors'
import {
  PROPERTY_LABELS,
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
} from '@/lib/schemas/work-order'

import type { AuthState } from '../../(auth)/auth-state'
import { initialAuthState } from '../../(auth)/auth-state'
import { approveWorkOrderAction, rejectWorkOrderAction } from '../actions'

// Urgency section a submission falls into. Assigned on the server (it depends
// on the current date) and used to group the queue list.
export type QueueBucket = 'immediate' | 'soon' | 'later'

export type QueueEntry = {
  id: string
  workOrderCode: string
  title: string
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
  bucket: QueueBucket
}

// The expanded detail for one submission, revealed inline beneath its list row.
// onDone fires after a successful approve/reject so the parent can collapse it.
export function QueueDetail({
  item,
  canModerate,
  timeZone,
  onDone,
}: {
  item: QueueEntry
  canModerate: boolean
  timeZone: string
  onDone: () => void
}) {
  const [showReject, setShowReject] = useState(false)

  const boundApprove = approveWorkOrderAction.bind(null, item.id)
  const [approveState, approveAction] = useActionState(
    boundApprove,
    initialAuthState
  )
  const boundReject = rejectWorkOrderAction.bind(null, item.id)
  const [rejectState, rejectAction] = useActionState(
    boundReject,
    initialAuthState
  )
  const { markEdited, getError } = useServerErrors(
    rejectState,
    rejectState.fieldErrors
  )
  const reasonError = getError('reason')

  const prevApprove = useRef<AuthState>(initialAuthState)
  useEffect(() => {
    if (prevApprove.current === approveState) return
    prevApprove.current = approveState
    if (approveState.status === 'success') {
      toast.success('Work order approved.')
      onDone()
    } else if (approveState.status === 'error' && approveState.message) {
      toast.error(approveState.message)
    }
  }, [approveState, onDone])

  const prevReject = useRef<AuthState>(initialAuthState)
  useEffect(() => {
    if (prevReject.current === rejectState) return
    prevReject.current = rejectState
    if (rejectState.status === 'success') {
      toast.success('Work order rejected.')
      onDone()
    }
  }, [rejectState, onDone])

  const locationLabel = item.property
    ? item.unitNumber
      ? `${PROPERTY_LABELS[item.property]} · Unit ${item.unitNumber}`
      : PROPERTY_LABELS[item.property]
    : null

  return (
    <div className="border-t bg-muted/20 px-4 py-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={item.priority} />
          <CategoryBadge category={item.category} />
          <div className="ml-auto flex items-center gap-2.5">
            <span className="text-xs font-medium tabular-nums text-muted-foreground/70">
              {item.workOrderCode}
            </span>
            <Link
              href={`/work-orders/${item.id}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open
              <RiArrowRightUpLine className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <p className="text-sm leading-6 whitespace-pre-line text-foreground/90">
          {item.description}
        </p>

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Detail icon={RiUserLine} label="Requested by">
            {item.reporterName ?? (
              <span className="text-muted-foreground">Not provided</span>
            )}
          </Detail>
          {item.reporterEmail ? (
            <Detail icon={RiMailLine} label="Email">
              <a href={`mailto:${item.reporterEmail}`} className="hover:underline">
                {item.reporterEmail}
              </a>
            </Detail>
          ) : null}
          {item.reporterPhone ? (
            <Detail icon={RiPhoneLine} label="Phone">
              <a href={`tel:${item.reporterPhone}`} className="hover:underline">
                {item.reporterPhone}
              </a>
            </Detail>
          ) : null}
          {locationLabel ? (
            <Detail icon={RiMapPinLine} label="Facility">
              {locationLabel}
            </Detail>
          ) : null}
          <Detail icon={RiCalendarEventLine} label="Due">
            {item.dueAt ? (
              formatDateTime(item.dueAt, timeZone)
            ) : (
              <span className="text-muted-foreground">No due date</span>
            )}
          </Detail>
          <Detail icon={RiCalendarEventLine} label="Submitted">
            <span
              suppressHydrationWarning
              title={formatDateTime(item.createdAt, timeZone)}
            >
              {formatRelative(item.createdAt, timeZone)}
            </span>
          </Detail>
        </dl>

        {!canModerate ? (
          <p className="border-t pt-4 text-sm text-muted-foreground">
            Awaiting administrator review.
          </p>
        ) : showReject ? (
          <form
            action={rejectAction}
            noValidate
            className="flex flex-col gap-3 border-t pt-4"
          >
            <FormError state={rejectState} />
            <FieldGroup>
              <Field data-invalid={reasonError ? 'true' : undefined}>
                <FieldLabel htmlFor={`reason-${item.id}`}>
                  Reason for rejection
                </FieldLabel>
                <Textarea
                  id={`reason-${item.id}`}
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
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              size="cta"
              className="w-28"
              onClick={() => setShowReject(true)}
            >
              Reject
            </Button>
            <form action={approveAction}>
              <SubmitButton
                label="Approve"
                pendingLabel="Approving..."
                className="w-28"
              />
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: RemixiconComponentType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" />
      <div className="flex min-w-0 flex-col">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="text-foreground">{children}</dd>
      </div>
    </div>
  )
}
