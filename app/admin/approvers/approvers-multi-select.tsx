'use client'

import { RiArrowDownSLine } from '@remixicon/react'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { MultiSelectFilter, type Option } from '@/components/ui/multi-select-filter'
import type { WorkOrderCategory } from '@/lib/schemas/work-order'

import { setCategoryApproversAction } from '../actions'

// Picks the administrators emailed for one category. Each change saves the full
// selection immediately. The checkbox list updates before the save finishes
// and reverts if the server rejects it. Next.js runs Server Actions from one
// client one at a time, so rapid toggles save in order and the last one wins.
export function ApproversMultiSelect({
  category,
  initialUserIds,
  options,
}: {
  category: WorkOrderCategory
  initialUserIds: string[]
  options: Option<string>[]
}) {
  const [selected, setSelected] = useState(initialUserIds)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const labelById = new Map(options.map((o) => [o.value, o.label]))
  const summary =
    selected.map((id) => labelById.get(id) ?? 'Unknown user').join(', ') ||
    'No approvers'

  function handleChange(next: string[]): void {
    const previous = selected
    setSelected(next)
    setError(null)
    startTransition(async () => {
      const message = await setCategoryApproversAction({
        category,
        userIds: next,
      })
      if (message) {
        setSelected(previous)
        setError(message)
      }
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <MultiSelectFilter
        label="Approvers"
        options={options}
        selected={selected}
        onChange={handleChange}
        trigger={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-72 max-w-full justify-between gap-1 font-normal"
          >
            <span
              className={
                selected.length > 0
                  ? 'truncate text-left'
                  : 'truncate text-left text-muted-foreground'
              }
            >
              {summary}
            </span>
            <RiArrowDownSLine className="size-4 shrink-0 opacity-60" />
          </Button>
        }
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
