'use client'

import { useState, useTransition } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ITRequestType, WorkOrderCategory } from '@/lib/schemas/work-order'

import { setDefaultAssigneeAction } from '../actions'

// Picks the default assignee for a category, or for one IT request type. Each
// change saves immediately. The selection updates before the save finishes and
// reverts if the server rejects it.
export function DefaultAssigneeSelect({
  category,
  itRequestType,
  initialUserId,
  options,
  emptyLabel,
}: {
  category: WorkOrderCategory
  itRequestType: ITRequestType | null
  initialUserId: string | null
  options: { value: string; label: string }[]
  // What leaving it empty means, e.g. "No default" or "Same as IT default".
  emptyLabel: string
}) {
  const [selected, setSelected] = useState(initialUserId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Value -> label map so the trigger can show the chosen name while the list
  // items are unmounted, and still fall back to the placeholder when empty.
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]))

  function handleChange(next: string): void {
    const previous = selected
    setSelected(next)
    setError(null)
    startTransition(async () => {
      const message = await setDefaultAssigneeAction({
        category,
        itRequestType,
        userId: next || null,
      })
      if (message) {
        setSelected(previous)
        setError(message)
      }
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Select
        items={items}
        value={selected}
        disabled={isPending}
        onValueChange={(v) => handleChange(typeof v === 'string' ? v : '')}
      >
        <SelectTrigger
          size="sm"
          className="w-72 max-w-full"
          aria-label="Default assignee"
        >
          <SelectValue placeholder={emptyLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={null}>{emptyLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
