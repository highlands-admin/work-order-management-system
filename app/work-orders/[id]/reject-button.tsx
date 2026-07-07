'use client'

import { RiMore2Line } from '@remixicon/react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RejectDialog } from '@/components/work-orders/reject-dialog'

import { rejectApprovedWorkOrderAction } from '../actions'

// Rejects a work order that's already active in the main table (open,
// in_progress, on_hold) straight from its detail page. Only rendered for
// administrators viewing a rejectable work order; the action re-checks the
// role and status independently.
//
// Tucked behind an overflow menu rather than a full-size button alongside
// Edit: unlike Approve (the expected action for a pending submission), this
// is a rare, destructive override on a work order already in active use, and
// there's no "unreject" -- it shouldn't sit at equal visual weight with
// routine actions where a misclick has real consequences.
export function RejectButton({ workOrderId }: { workOrderId: string }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function confirm(reason: string) {
    startTransition(async () => {
      const result = await rejectApprovedWorkOrderAction(workOrderId, reason)
      if (result.status === 'error') {
        toast.error(result.message ?? 'Could not reject the work order.')
      } else {
        setDialogOpen(false)
        toast.success('Work order rejected.')
      }
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label="More actions"
            >
              <RiMore2Line />
            </Button>
          }
        />
        <DropdownMenuContent>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDialogOpen(true)}
          >
            Reject
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RejectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pending={isPending}
        onConfirm={confirm}
      />
    </>
  )
}
