import { RiCloseCircleLine } from '@remixicon/react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { buttonVariants } from '@/components/ui/button'
import {
  CategoryBadge,
  PriorityBadge,
  StatusBadge,
} from '@/components/work-orders/work-order-badge'
import { formatDateTime } from '@/lib/datetime/format'
import { getTimeZone } from '@/lib/datetime/timezone'
import {
  MARKETING_REQUEST_TYPE_LABELS,
  MARKETING_SIZE_FORMAT_LABELS,
  MARKETING_TARGET_AUDIENCE_LABELS,
  PROPERTY_LABELS,
  type MarketingRequestType,
  type MarketingSizeFormat,
  type MarketingTargetAudience,
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'
import { createClient } from '@/lib/supabase/server'
import {
  fetchAssignableUsers,
  formatAssigneeLabel,
  type AssignableUser,
} from '@/lib/work-orders/assignable-users'

import { NotesSection, type NoteRow } from '../notes-section'
import { ActivityFeed, type ActivityEvent } from './activity-feed'
import { BackButton } from './back-button'

export const metadata: Metadata = { title: 'Work Order' }

const EDITOR_ROLES = new Set(['administrator', 'requester'])
const TRANSITION_ROLES = new Set(['technician', 'inspector'])
const CLOSED_STATUSES = new Set<WorkOrderStatus>(['done', 'closed'])

type WorkOrderRow = {
  id: string
  work_order_code: string
  title: string
  category: WorkOrderCategory
  status: WorkOrderStatus
  property: Property | null
  unit_number: string | null
  priority: WorkOrderPriority
  due_at: string | null
  description: string
  resolution: string | null
  assigned_to: string | null
  created_by: string
  updated_by: string
  reported_by_name: string | null
  reported_by_email: string | null
  reported_by_phone: string | null
  marketing_request_type: string | null
  marketing_request_type_other: string | null
  marketing_event_name: string | null
  marketing_target_audience: string[] | null
  marketing_target_audience_other: string | null
  marketing_key_message: string | null
  marketing_size_format: string[] | null
  marketing_size_format_other: string | null
  rejected_reason: string | null
  rejected_at: string | null
  rejected_by: string | null
  created_at: string
  updated_at: string
}

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as
    | { sub?: string; user_role?: string }
    | undefined

  if (!claims) redirect('/login')

  const [{ data, error }, assignableUsers, { data: notesData }, { data: activityData }] =
    await Promise.all([
      supabase
        .from('work_orders')
        .select(
          'id, work_order_code, title, category, status, property, unit_number, priority, due_at, description, resolution, assigned_to, created_by, updated_by, reported_by_name, reported_by_email, reported_by_phone, marketing_request_type, marketing_request_type_other, marketing_event_name, marketing_target_audience, marketing_target_audience_other, marketing_key_message, marketing_size_format, marketing_size_format_other, rejected_reason, rejected_at, rejected_by, created_at, updated_at'
        )
        .eq('id', id)
        .maybeSingle<WorkOrderRow>(),
      fetchAssignableUsers(supabase),
      supabase
        .from('work_order_notes')
        .select('id, body, created_by, created_at, updated_at')
        .eq('work_order_id', id)
        .order('created_at', { ascending: true })
        .returns<NoteRow[]>(),
      supabase
        .from('work_order_activity')
        .select('id, actor_id, action, details, created_at')
        .eq('work_order_id', id)
        .order('created_at', { ascending: false })
        .returns<ActivityEvent[]>(),
    ])

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <h1 className="font-heading text-2xl font-semibold">Work Order</h1>
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    )
  }

  if (!data) notFound()

  const userById = new Map<string, AssignableUser>(
    assignableUsers.map((u) => [u.user_id, u])
  )
  // Plain object label map for the (client) notes section, which needs a
  // serializable prop across the Server/Client boundary.
  const userLabelById: Record<string, string> = Object.fromEntries(
    assignableUsers.map((u) => [u.user_id, formatAssigneeLabel(u)])
  )
  const role = claims.user_role
  const canEdit = role ? EDITOR_ROLES.has(role) : false
  const canTransition = role ? TRANSITION_ROLES.has(role) : false
  const hasReporter =
    data.reported_by_name || data.reported_by_email || data.reported_by_phone
  const isRejected = data.status === 'rejected'
  const isOverdue = computeIsOverdue(data.due_at, data.status)
  const timeZone = await getTimeZone()

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-3">
        <BackButton />
        {canEdit || canTransition ? (
          <Link
            href={`/work-orders/${data.id}/edit`}
            className={buttonVariants({ size: 'lg' })}
          >
            {canEdit ? 'Edit work order' : 'Update status'}
          </Link>
        ) : null}
      </div>

      {/* Header */}
      <header className="flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide tabular-nums text-muted-foreground">
          {data.work_order_code}
        </span>
        <h1 className="font-heading text-2xl font-semibold leading-tight sm:text-3xl">
          {data.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={data.status} />
          <PriorityBadge priority={data.priority} />
          <CategoryBadge category={data.category} />
        </div>
      </header>

      {/* Rejection is the most important thing to see, so surface it up top. */}
      {isRejected ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-destructive">
            <RiCloseCircleLine className="size-4 shrink-0" />
            Rejected
            {data.rejected_at ? (
              <span className="font-normal text-destructive/80">
                {formatDateTime(data.rejected_at, timeZone)}
                {data.rejected_by
                  ? ` by ${formatUser(data.rejected_by, userById)}`
                  : ''}
              </span>
            ) : null}
          </div>
          {data.rejected_reason ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground/90">
              {data.rejected_reason}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column: the narrative */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Section title="Description">
            <p className="whitespace-pre-line text-sm leading-6 text-foreground/90">
              {data.description}
            </p>
          </Section>

          {data.resolution ? (
            <Section title="Resolution">
              <p className="whitespace-pre-line text-sm leading-6 text-foreground/90">
                {data.resolution}
              </p>
            </Section>
          ) : null}

          {data.category === 'marketing' ? (
            <Section title="Marketing brief">
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                <DetailItem label="Type of request">
                  {formatRequestType(
                    data.marketing_request_type,
                    data.marketing_request_type_other
                  )}
                </DetailItem>
                <DetailItem label="Name or title of event">
                  {data.marketing_event_name ?? <Empty />}
                </DetailItem>
                <DetailItem label="Target audience">
                  {formatAudience(
                    data.marketing_target_audience,
                    data.marketing_target_audience_other
                  )}
                </DetailItem>
                <DetailItem label="Size / format needed">
                  {formatSizeFormat(
                    data.marketing_size_format,
                    data.marketing_size_format_other
                  )}
                </DetailItem>
                <DetailItem label="Key message or theme">
                  {data.marketing_key_message ? (
                    <span className="whitespace-pre-line text-foreground/90">
                      {data.marketing_key_message}
                    </span>
                  ) : (
                    <Empty />
                  )}
                </DetailItem>
              </dl>
            </Section>
          ) : null}

          <NotesSection
            workOrderId={data.id}
            notes={notesData ?? []}
            userById={userLabelById}
            currentUserId={claims.sub ?? ''}
            canModerate={role === 'administrator'}
            timeZone={timeZone}
          />

          <ActivityFeed
            events={activityData ?? []}
            userLabelById={userLabelById}
            timeZone={timeZone}
          />
        </div>

        {/* Sidebar: scannable metadata. Sticky so the short panel stays in view
            beside the long content instead of leaving a dead gap. */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
          <Section title="Details">
            <dl className="flex flex-col gap-4 text-sm">
              <DetailItem label="Property">
                {data.property ? (
                  PROPERTY_LABELS[data.property]
                ) : (
                  <span className="text-muted-foreground">Not specified</span>
                )}
              </DetailItem>
              <DetailItem label="Unit">{data.unit_number ?? <Empty />}</DetailItem>
              <DetailItem label="Due">
                {data.due_at ? (
                  <span
                    className={
                      isOverdue ? 'font-medium text-destructive' : undefined
                    }
                  >
                    {formatDateTime(data.due_at, timeZone)}
                    {isOverdue ? ' · Overdue' : ''}
                  </span>
                ) : (
                  <Empty />
                )}
              </DetailItem>
              <DetailItem label="Assigned to">
                {data.assigned_to ? (
                  formatUser(data.assigned_to, userById)
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </DetailItem>
            </dl>
          </Section>

          {hasReporter ? (
            <Section title="Reporter">
              <dl className="flex flex-col gap-4 text-sm">
                <DetailItem label="Name">
                  {data.reported_by_name ?? <Empty />}
                </DetailItem>
                <DetailItem label="Email">
                  {data.reported_by_email ? (
                    <a
                      href={`mailto:${data.reported_by_email}`}
                      className="break-all text-primary underline-offset-4 hover:underline"
                    >
                      {data.reported_by_email}
                    </a>
                  ) : (
                    <Empty />
                  )}
                </DetailItem>
                <DetailItem label="Phone">
                  {data.reported_by_phone ? (
                    <a
                      href={`tel:${data.reported_by_phone}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {data.reported_by_phone}
                    </a>
                  ) : (
                    <Empty />
                  )}
                </DetailItem>
              </dl>
            </Section>
          ) : null}

        </aside>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <header className="border-b bg-muted/30 px-6 py-4">
        <h2 className="font-heading text-base font-semibold tracking-tight">
          {title}
        </h2>
      </header>
      <div className="px-6 py-6">{children}</div>
    </section>
  )
}

function DetailItem({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  )
}

function Empty() {
  return <span className="text-muted-foreground">—</span>
}

function formatRequestType(
  value: string | null,
  other: string | null
): ReactNode {
  if (!value) return <Empty />
  if (value === 'other') return other ?? <Empty />
  return value in MARKETING_REQUEST_TYPE_LABELS
    ? MARKETING_REQUEST_TYPE_LABELS[value as MarketingRequestType]
    : value
}

function formatSizeFormat(
  values: string[] | null,
  other: string | null
): ReactNode {
  if (!values || values.length === 0) return <Empty />
  const labels = values.map((v) =>
    v === 'other'
      ? (other ?? MARKETING_SIZE_FORMAT_LABELS.other)
      : v in MARKETING_SIZE_FORMAT_LABELS
        ? MARKETING_SIZE_FORMAT_LABELS[v as MarketingSizeFormat]
        : v
  )
  return labels.join(', ')
}

function formatAudience(
  values: string[] | null,
  other: string | null
): ReactNode {
  if (!values || values.length === 0) return <Empty />
  const labels = values.map((v) =>
    v === 'other'
      ? (other ?? MARKETING_TARGET_AUDIENCE_LABELS.other)
      : v in MARKETING_TARGET_AUDIENCE_LABELS
        ? MARKETING_TARGET_AUDIENCE_LABELS[v as MarketingTargetAudience]
        : v
  )
  return labels.join(', ')
}

function formatUser(
  userId: string,
  byId: Map<string, AssignableUser>
): string {
  const user = byId.get(userId)
  if (!user) return userId.slice(0, 8)
  return formatAssigneeLabel(user)
}

// Kept out of the component body so the date read isn't flagged as an impure
// call during render. A work order is overdue when its due date has passed and
// it isn't already done or closed.
function computeIsOverdue(
  dueAt: string | null,
  status: WorkOrderStatus
): boolean {
  if (!dueAt || CLOSED_STATUSES.has(status)) return false
  return new Date(dueAt).getTime() < Date.now()
}
