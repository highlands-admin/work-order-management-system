'use client'

import {
  RiChat3Line,
  RiCheckboxCircleLine,
  RiCloseLine,
  RiCloseCircleLine,
  RiLoopRightLine,
  RiNotification3Line,
  RiUserReceivedLine,
  type RemixiconComponentType,
} from '@remixicon/react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { formatRelative } from '@/lib/datetime/format'
import { cn } from '@/lib/utils'

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  clearNotificationAction,
  clearAllNotificationsAction,
} from './actions'

export type NotificationRow = {
  id: string
  type: string
  title: string
  body: string | null
  work_order_id: string | null
  read_at: string | null
  created_at: string
}

const TYPE_META: Record<
  string,
  { icon: RemixiconComponentType; className: string }
> = {
  assigned: {
    icon: RiUserReceivedLine,
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  },
  approved: {
    icon: RiCheckboxCircleLine,
    className:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  rejected: {
    icon: RiCloseCircleLine,
    className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  },
  status_changed: {
    icon: RiLoopRightLine,
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  note_added: {
    icon: RiChat3Line,
    className:
      'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  },
  note_edited: {
    icon: RiChat3Line,
    className:
      'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  },
  note_deleted: {
    icon: RiChat3Line,
    className:
      'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  },
}

const DEFAULT_META = {
  icon: RiNotification3Line,
  className: 'bg-muted text-muted-foreground',
}

export function NotificationsList({
  notifications,
  timeZone,
}: {
  notifications: NotificationRow[]
  timeZone: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const hasUnread = notifications.some((n) => !n.read_at)

  function open(notification: NotificationRow) {
    startTransition(async () => {
      if (!notification.read_at) {
        await markNotificationReadAction(notification.id)
      }
      if (notification.work_order_id) {
        router.push(`/work-orders/${notification.work_order_id}`)
      }
    })
  }

  function markAll() {
    startTransition(() => {
      void markAllNotificationsReadAction()
    })
  }

  function clearOne(e: React.MouseEvent, notificationId: string) {
    e.stopPropagation()
    startTransition(() => {
      void clearNotificationAction(notificationId)
    })
  }

  function clearAll() {
    startTransition(() => {
      void clearAllNotificationsAction()
    })
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Updates on work orders assigned to you and your submissions.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasUnread ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={markAll}
              disabled={isPending}
            >
              Mark all as read
            </Button>
          ) : null}
          {notifications.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearAll}
              disabled={isPending}
            >
              Clear all
            </Button>
          ) : null}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <RiNotification3Line className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">You&apos;re all caught up!</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Updates about your work orders will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-foreground/5 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 shadow-md dark:shadow-none">
          {notifications.map((n) => {
            const meta = TYPE_META[n.type] ?? DEFAULT_META
            const Icon = meta.icon
            const unread = !n.read_at
            return (
              <li
                key={n.id}
                className={cn(
                  'group/row relative',
                  unread && 'bg-primary/5'
                )}
              >
                {/* Main row — navigates to the work order and marks as read. */}
                <button
                  type="button"
                  onClick={() => open(n)}
                  className="flex w-full items-start gap-3 px-4 py-3.5 pr-10 text-left transition-colors hover:bg-muted/40"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                      meta.className
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm',
                        unread ? 'font-semibold text-foreground' : 'text-foreground'
                      )}
                    >
                      {n.title}
                    </p>
                    {n.body ? (
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {n.body}
                      </p>
                    ) : null}
                    <time
                      className="mt-1 block text-xs text-muted-foreground tabular-nums"
                      dateTime={n.created_at}
                      suppressHydrationWarning
                    >
                      {formatRelative(n.created_at, timeZone)}
                    </time>
                  </div>
                  {unread ? (
                    <span
                      aria-label="Unread"
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                    />
                  ) : null}
                </button>

                {/* Dismiss button — sibling of the row button, not a descendant.
                    Nested <button> inside <button> is invalid HTML. */}
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearOne(e, n.id)
                  }}
                  disabled={isPending}
                  className="absolute right-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/row:opacity-100 focus-visible:opacity-100"
                >
                  <RiCloseLine className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
