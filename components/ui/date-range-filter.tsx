'use client'

import { RiArrowDownSLine, RiCloseLine } from '@remixicon/react'
import type { ReactElement } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export function DateRangeFilter({
  label,
  from,
  to,
  onChange,
  trigger,
}: {
  label: string
  from: string | null
  to: string | null
  onChange: (next: { from: string | null; to: string | null }) => void
  // Swap in a compact trigger (e.g. a column-header filter icon) in place of
  // the default labeled button. The popover contents are unchanged.
  trigger?: ReactElement
}) {
  const active = Boolean(from || to)
  const summary = formatRange(from, to)

  return (
    <Popover>
      <PopoverTrigger
        render={
          trigger ?? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'h-9 justify-between gap-1 font-normal',
                active && 'border-foreground/30'
              )}
            >
              <span className="truncate">{summary ?? label}</span>
              <RiArrowDownSLine className="ml-1 size-4 opacity-60" />
            </Button>
          )
        }
      />
      <PopoverContent className="w-72 p-3" align="start">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor={`${label}-from`}
              className="text-xs text-muted-foreground"
            >
              From
            </Label>
            <Input
              id={`${label}-from`}
              type="date"
              value={from ?? ''}
              onChange={(e) =>
                onChange({ from: e.target.value || null, to })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor={`${label}-to`}
              className="text-xs text-muted-foreground"
            >
              To
            </Label>
            <Input
              id={`${label}-to`}
              type="date"
              value={to ?? ''}
              onChange={(e) =>
                onChange({ from, to: e.target.value || null })
              }
            />
          </div>
          {active ? (
            <button
              type="button"
              onClick={() => onChange({ from: null, to: null })}
              className="flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              <RiCloseLine className="size-3.5" />
              Clear range
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function formatRange(from: string | null, to: string | null): string | null {
  if (!from && !to) return null
  const f = from ? format(from) : '…'
  const t = to ? format(to) : '…'
  return `${f} – ${t}`
}

function format(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${m}/${d}/${y.slice(2)}`
}
