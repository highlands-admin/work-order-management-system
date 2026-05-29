import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { buttonVariants } from '@/components/ui/button'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  PROPERTY_LABELS,
  STATUS_LABELS,
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

export const metadata: Metadata = { title: 'Work Order' }

const EDITOR_ROLES = new Set(['administrator', 'requester'])
const TRANSITION_ROLES = new Set(['technician', 'inspector'])

const STATUS_COLOR: Record<WorkOrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  open: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  assigned: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  closed: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700/30 dark:text-zinc-300',
  rejected: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
}

const PRIORITY_COLOR: Record<WorkOrderPriority, string> = {
  urgent: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  low: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300',
}

type WorkOrderRow = {
  id: string
  category: WorkOrderCategory
  status: WorkOrderStatus
  property: Property | null
  unit_number: string | null
  priority: WorkOrderPriority
  due_at: string | null
  description: string
  resolution: string | null
  assigned_to: string
  created_by: string
  updated_by: string
  reported_by_name: string | null
  reported_by_email: string | null
  reported_by_phone: string | null
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

  const [{ data, error }, assignableUsers] = await Promise.all([
    supabase
      .from('work_orders')
      .select(
        'id, category, status, property, unit_number, priority, due_at, description, resolution, assigned_to, created_by, updated_by, reported_by_name, reported_by_email, reported_by_phone, rejected_reason, rejected_at, rejected_by, created_at, updated_at'
      )
      .eq('id', id)
      .maybeSingle<WorkOrderRow>(),
    fetchAssignableUsers(supabase),
  ])

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <h1 className="font-heading text-2xl font-semibold">Work Order</h1>
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    )
  }

  if (!data) notFound()

  const userById = new Map<string, AssignableUser>(
    assignableUsers.map((u) => [u.user_id, u])
  )
  const role = claims.user_role
  const canEdit = role ? EDITOR_ROLES.has(role) : false
  const canTransition = role ? TRANSITION_ROLES.has(role) : false
  const hasReporter =
    data.reported_by_name || data.reported_by_email || data.reported_by_phone
  const isRejected = data.status === 'rejected'

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2 sm:order-last sm:shrink-0">
          <Link
            href="/work-orders"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Back to list
          </Link>
          {canEdit || canTransition ? (
            <Link
              href={`/work-orders/${data.id}/edit`}
              className={buttonVariants({ size: 'sm' })}
            >
              {canEdit ? 'Edit' : 'Update status'}
            </Link>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="font-heading text-2xl font-semibold whitespace-pre-line">
            {data.description}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[data.status]}`}
            >
              {STATUS_LABELS[data.status]}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLOR[data.priority]}`}
            >
              {PRIORITY_LABELS[data.priority]}
            </span>
            <span className="text-muted-foreground">
              {CATEGORY_LABELS[data.category]}
            </span>
          </div>
        </div>
      </div>

      {data.resolution ? (
        <Section title="Resolution">
          <p className="whitespace-pre-line text-sm leading-6 text-foreground/90">
            {data.resolution}
          </p>
        </Section>
      ) : null}

      <Section title="Details">
        {/* Location and assignment */}
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <DetailItem label="Property">
            {data.property ? PROPERTY_LABELS[data.property] : 'Not specified'}
          </DetailItem>
          <DetailItem label="Unit">
            {data.unit_number ?? <Empty />}
          </DetailItem>
          <DetailItem label="Due">
            {data.due_at ? formatDateTime(data.due_at) : <Empty />}
          </DetailItem>
          <DetailItem label="Assigned to">
            {formatUser(data.assigned_to, userById)}
          </DetailItem>
        </dl>

        <hr className="my-6 border-foreground/10" />

        {/* Audit trail */}
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <DetailItem label="Created by">
            {formatUser(data.created_by, userById)}
          </DetailItem>
          <DetailItem label="Created at">
            {formatDateTime(data.created_at)}
          </DetailItem>
          <DetailItem label="Last updated by">
            {formatUser(data.updated_by, userById)}
          </DetailItem>
          <DetailItem label="Last updated at">
            {formatDateTime(data.updated_at)}
          </DetailItem>
        </dl>
      </Section>

      {hasReporter ? (
        <Section title="Reporter">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-3">
            <DetailItem label="Name">
              {data.reported_by_name ?? <Empty />}
            </DetailItem>
            <DetailItem label="Email">
              {data.reported_by_email ? (
                <a
                  href={`mailto:${data.reported_by_email}`}
                  className="text-foreground underline-offset-4 hover:underline"
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
                  className="text-foreground underline-offset-4 hover:underline"
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

      {isRejected || data.rejected_reason ? (
        <Section title="Rejection">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
            <DetailItem label="Rejected by">
              {data.rejected_by ? formatUser(data.rejected_by, userById) : <Empty />}
            </DetailItem>
            <DetailItem label="Rejected at">
              {data.rejected_at ? formatDateTime(data.rejected_at) : <Empty />}
            </DetailItem>
            {data.rejected_reason ? (
              <DetailItem label="Reason">
                <span className="whitespace-pre-line text-foreground/90">
                  {data.rejected_reason}
                </span>
              </DetailItem>
            ) : null}
          </dl>
        </Section>
      ) : null}
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

function formatUser(
  userId: string,
  byId: Map<string, AssignableUser>
): string {
  const user = byId.get(userId)
  if (!user) return userId.slice(0, 8)
  return formatAssigneeLabel(user)
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
