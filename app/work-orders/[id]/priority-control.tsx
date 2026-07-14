'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PRIORITY_COLOR } from '@/components/work-orders/work-order-badge'
import {
  PRIORITY_LABELS,
  WORK_ORDER_PRIORITIES,
  type WorkOrderPriority,
} from '@/lib/schemas/work-order'
import { cn } from '@/lib/utils'

import { changeWorkOrderPriorityAction } from '../actions'

// Inline priority picker on the work order detail page, shown to admins.
// Changing the selection commits immediately (no separate save), like the
// status control. The pill is optimistic and reverts if the server rejects it.
export function PriorityControl({
  workOrderId,
  priority,
}: {
  workOrderId: string
  priority: WorkOrderPriority
}) {
  const [serverPriority, setServerPriority] = useState<WorkOrderPriority>(priority)
  const [value, setValue] = useState<WorkOrderPriority>(priority)
  const [isPending, startTransition] = useTransition()

  // Re-sync to the server value after a revalidation delivers a new prop.
  if (serverPriority !== priority) {
    setServerPriority(priority)
    setValue(priority)
  }

  function onChange(next: WorkOrderPriority) {
    if (next === value) return
    const previous = value
    setValue(next)
    startTransition(async () => {
      const result = await changeWorkOrderPriorityAction(workOrderId, next)
      if (result.status === 'error') {
        setValue(previous)
        toast.error(result.message ?? 'Could not update the priority.')
      } else {
        toast.success(`Priority set to ${PRIORITY_LABELS[next]}.`)
      }
    })
  }

  return (
    <Select
      items={PRIORITY_LABELS}
      value={value}
      onValueChange={(v) => onChange(v as WorkOrderPriority)}
    >
      <SelectTrigger
        aria-label="Change priority"
        className={cn(
          'h-9 gap-1.5 rounded-full border-transparent px-3.5 text-sm font-semibold shadow-sm transition-opacity',
          PRIORITY_COLOR[value],
          isPending && 'opacity-60'
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {WORK_ORDER_PRIORITIES.map((p) => (
          <SelectItem key={p} value={p}>
            {PRIORITY_LABELS[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
