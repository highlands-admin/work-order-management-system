'use client'

import { RiArrowDownSLine, RiCloseLine } from '@remixicon/react'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type Option<T extends string> = {
  value: T
  label: string
}

export function MultiSelectFilter<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: Option<T>[]
  selected: T[]
  onChange: (next: T[]) => void
}) {
  const selectedSet = new Set<T>(selected)

  function toggle(value: T) {
    const next = new Set(selectedSet)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    onChange(options.map((o) => o.value).filter((v) => next.has(v)))
  }

  function clear() {
    onChange([])
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              'h-9 justify-between gap-1 font-normal',
              selected.length > 0 && 'border-foreground/30'
            )}
          >
            <span className="flex-1 text-left">{label}</span>
            {selected.length > 0 ? (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-medium text-background">
                {selected.length}
              </span>
            ) : null}
            <RiArrowDownSLine className="ml-1 size-4 opacity-60" />
          </Button>
        }
      />
      <PopoverContent className="w-56 gap-1 p-1" align="start">
        <ul className="max-h-72 overflow-auto pt-1">
          {options.map((opt) => {
            const isChecked = selectedSet.has(opt.value)
            const id = `filter-${label.toLowerCase().replace(/\s+/g, '-')}-${opt.value}`
            return (
              <li key={opt.value}>
                <label
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(opt.value)}
                    className="size-4 rounded border-input accent-foreground"
                  />
                  <span>{opt.label}</span>
                </label>
              </li>
            )
          })}
        </ul>
        {selected.length > 0 ? (
          <>
            <div className="border-t" />
            <button
              type="button"
              onClick={clear}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
            >
              <RiCloseLine className="size-3.5" />
              Clear {label.toLowerCase()}
            </button>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
