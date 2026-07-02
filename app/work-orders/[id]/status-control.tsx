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
import { CloseDialog } from '@/components/work-orders/close-dialog'
import { ResolutionDialog } from '@/components/work-orders/resolution-dialog'
import { STATUS_COLOR } from '@/components/work-orders/work-order-badge'
import {
  MAIN_TABLE_STATUSES,
  STATUS_LABELS,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'
import { cn } from '@/lib/utils'
import type { AssignableUser } from '@/lib/work-orders/assignable-users'

import { changeWorkOrderStatusAction } from '../actions'

// Prominent, inline status picker shown on the work order detail page to the
// admin, the assignee, and the creator. Changing the selection commits the
// new status immediately (no separate save), like a ticketing system. The
// pill is optimistic and reverts if the server rejects the change.
export function StatusControl({
  workOrderId,
  status,
  users,
}: {
  workOrderId: string
  status: WorkOrderStatus
  users: AssignableUser[]
}) {
  const [serverStatus, setServerStatus] = useState<WorkOrderStatus>(status)
  const [value, setValue] = useState<WorkOrderStatus>(status)
  const [doneDialogOpen, setDoneDialogOpen] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Re-sync to the server value after a revalidation delivers a new prop.
  if (serverStatus !== status) {
    setServerStatus(status)
    setValue(status)
  }

  function commit(
    next: WorkOrderStatus,
    resolution?: string,
    validatedBy?: string
  ) {
    const previous = value
    setValue(next)
    startTransition(async () => {
      const result = await changeWorkOrderStatusAction(
        workOrderId,
        next,
        resolution,
        validatedBy
      )
      if (result.status === 'error') {
        setValue(previous)
        toast.error(result.message ?? 'Could not update the status.')
      } else {
        toast.success(`Status changed to ${STATUS_LABELS[next]}.`)
      }
    })
  }

  function onChange(next: WorkOrderStatus) {
    if (next === value) return
    // Moving to Done requires a resolution; moving to Closed requires a
    // validator (and a resolution unless already Done). Collect these in a
    // modal, then commit. The select stays on its current value until confirmed.
    if (next === 'done') {
      setDoneDialogOpen(true)
      return
    }
    if (next === 'closed') {
      setCloseDialogOpen(true)
      return
    }
    commit(next)
  }

  return (
    <div className="flex flex-col gap-1">
      <Select
        items={STATUS_LABELS}
        value={value}
        onValueChange={(v) => onChange(v as WorkOrderStatus)}
      >
        <SelectTrigger
          aria-label="Change status"
          className={cn(
            'h-9 gap-1.5 rounded-full border-transparent px-3.5 text-sm font-semibold shadow-sm transition-opacity',
            STATUS_COLOR[value],
            isPending && 'opacity-60'
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MAIN_TABLE_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ResolutionDialog
        open={doneDialogOpen}
        onOpenChange={setDoneDialogOpen}
        pending={isPending}
        onConfirm={(resolution) => {
          setDoneDialogOpen(false)
          commit('done', resolution)
        }}
      />

      <CloseDialog
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        users={users}
        // A work order already Done carries a resolution; a direct move from
        // Open / In Progress must supply one now.
        requireResolution={serverStatus !== 'done'}
        pending={isPending}
        onConfirm={({ resolution, validatedBy }) => {
          setCloseDialogOpen(false)
          commit('closed', resolution, validatedBy)
        }}
      />
    </div>
  )
}
