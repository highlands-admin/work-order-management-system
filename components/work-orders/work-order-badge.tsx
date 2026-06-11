import { Badge } from '@/components/ui/badge'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type WorkOrderCategory,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'
import { cn } from '@/lib/utils'

// Single source of truth for the status and priority pill colors. The detail
// page, the list table, and the approval queue all render through these so the
// palette stays consistent everywhere. Each entry pairs a light and dark tone.
export const STATUS_COLOR: Record<WorkOrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  open: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  closed: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700/30 dark:text-zinc-300',
  rejected: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
}

export const PRIORITY_COLOR: Record<WorkOrderPriority, string> = {
  urgent: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  low: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300',
}

export function StatusBadge({
  status,
  className,
}: {
  status: WorkOrderStatus
  className?: string
}): React.JSX.Element {
  return (
    <Badge className={cn(STATUS_COLOR[status], className)}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: WorkOrderPriority
  className?: string
}): React.JSX.Element {
  return (
    <Badge className={cn(PRIORITY_COLOR[priority], className)}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  )
}

export function CategoryBadge({
  category,
  className,
}: {
  category: WorkOrderCategory
  className?: string
}): React.JSX.Element {
  return (
    <Badge variant="outline" className={className}>
      {CATEGORY_LABELS[category]}
    </Badge>
  )
}
