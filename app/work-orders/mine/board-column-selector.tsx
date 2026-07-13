'use client'

import { RiArrowDownSLine, RiLayoutColumnLine } from '@remixicon/react'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  MAIN_TABLE_STATUSES,
  STATUS_LABELS,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'
import { cn } from '@/lib/utils'

// Picks which status columns the Kanban board shows. Every main-table status is
// an option; the current selection is passed in and reflected back through
// onChange. The board always keeps at least one column, so the last remaining
// column cannot be turned off.
export function BoardColumnSelector({
  selected,
  onChange,
}: {
  selected: WorkOrderStatus[]
  onChange: (next: WorkOrderStatus[]) => void
}) {
  const selectedSet = new Set(selected)

  function toggle(status: WorkOrderStatus) {
    const next = new Set(selectedSet)
    if (next.has(status)) {
      if (next.size === 1) return
      next.delete(status)
    } else {
      next.add(status)
    }
    // Report in canonical order so the board's column order stays stable.
    onChange(MAIN_TABLE_STATUSES.filter((s) => next.has(s)))
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1.5 font-normal"
          >
            <RiLayoutColumnLine className="size-4 opacity-70" aria-hidden={true} />
            Columns
            <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium tabular-nums">
              {selected.length}
            </span>
            <RiArrowDownSLine className="size-4 opacity-60" aria-hidden={true} />
          </Button>
        }
      />
      <PopoverContent className="w-56 gap-1 p-1" align="end">
        <p className="px-2 pb-1 pt-1.5 text-xs text-muted-foreground">
          Show status columns
        </p>
        <ul>
          {MAIN_TABLE_STATUSES.map((status) => {
            const isChecked = selectedSet.has(status)
            // The single remaining column can't be unchecked.
            const locked = isChecked && selected.length === 1
            const id = `board-column-${status}`
            return (
              <li key={status}>
                <label
                  htmlFor={id}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                    locked
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-pointer hover:bg-muted'
                  )}
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={isChecked}
                    disabled={locked}
                    onChange={() => toggle(status)}
                    className="size-4 rounded border-input accent-foreground"
                  />
                  <span>{STATUS_LABELS[status]}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
