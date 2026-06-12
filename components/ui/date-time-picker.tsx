'use client'

import { format, parseISO } from 'date-fns'
import { RiCalendarLine } from '@remixicon/react'
import { useState, type ChangeEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const DEFAULT_TIME = '09:00'

export function DateTimePicker({
  id,
  name,
  value,
  onChange,
  placeholder = 'Pick a date and time',
  ariaInvalid,
  className,
}: {
  id?: string
  name?: string
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  ariaInvalid?: boolean
  className?: string
}) {
  const initialDate = value ? safeParseDate(value) : undefined
  const [date, setDate] = useState<Date | undefined>(initialDate)
  const [time, setTime] = useState<string>(
    initialDate ? format(initialDate, 'HH:mm') : ''
  )

  function emit(nextDate: Date | undefined, nextTime: string) {
    onChange?.(composeIso(nextDate, nextTime))
  }

  function handleDateSelect(next: Date | undefined) {
    setDate(next)
    if (next && !time) {
      setTime(DEFAULT_TIME)
      emit(next, DEFAULT_TIME)
    } else {
      emit(next, time)
    }
  }

  function handleTimeChange(e: ChangeEvent<HTMLInputElement>) {
    setTime(e.target.value)
    emit(date, e.target.value)
  }

  const display =
    date && time
      ? `${format(date, 'PPP')} · ${formatTime12(time)}`
      : date
        ? format(date, 'PPP')
        : null

  const timeInputId = `${id ?? 'date-time'}-time`

  return (
    <>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              aria-invalid={ariaInvalid}
              className={cn(
                // Match the input/select fields: 16px on mobile to avoid the
                // iOS focus zoom, 14px from md up.
                'w-full justify-start text-base font-normal md:text-sm',
                !date && 'text-muted-foreground',
                className
              )}
            >
              <RiCalendarLine className="mr-2 size-4 shrink-0" />
              <span className="truncate">{display ?? placeholder}</span>
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            autoFocus
          />
          <div className="flex items-center gap-3 border-t px-3 py-3">
            <Label
              htmlFor={timeInputId}
              className="text-xs font-medium text-muted-foreground"
            >
              Time
            </Label>
            <Input
              id={timeInputId}
              type="time"
              value={time}
              onChange={handleTimeChange}
              className="h-8 w-32"
            />
          </div>
        </PopoverContent>
      </Popover>
      {name ? (
        <input type="hidden" name={name} value={composeIso(date, time)} />
      ) : null}
    </>
  )
}

function safeParseDate(value: string): Date | undefined {
  const d = parseISO(value)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function composeIso(date: Date | undefined, time: string): string {
  if (!date || !time) return ''
  const [h, m] = time.split(':').map((part) => parseInt(part, 10))
  if (Number.isNaN(h) || Number.isNaN(m)) return ''
  const out = new Date(date)
  out.setHours(h, m, 0, 0)
  return Number.isNaN(out.getTime()) ? '' : out.toISOString()
}

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map((p) => parseInt(p, 10))
  if (Number.isNaN(h) || Number.isNaN(m)) return time
  const period = h >= 12 ? 'PM' : 'AM'
  const hh = ((h + 11) % 12) + 1
  const mm = m.toString().padStart(2, '0')
  return `${hh}:${mm} ${period}`
}
