'use client'

import { RiAddLine, RiCloseLine } from '@remixicon/react'
import { useState } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { REMINDER_LEAD_OPTIONS } from '@/lib/schemas/work-order'

const LEAD_VALUES = REMINDER_LEAD_OPTIONS.map((o) => o.value)
// Value -> label map so a closed Select shows "2 weeks before", not the raw
// number, matching how the other selects in the app render their value.
const LEAD_ITEMS: Record<string, string> = Object.fromEntries(
  REMINDER_LEAD_OPTIONS.map((o) => [String(o.value), o.label])
)

// Calendar-style reminder setup for a recurring schedule: a list of email alerts
// (each a lead time before the due date) that grows as you add them. The people
// who receive them are the work order's Recipients, chosen elsewhere in the
// form. Values submit as repeated `reminderLeadDays` fields, read with
// formData.getAll in the action.
export function RecurrenceReminders({
  defaultLeadDays,
}: {
  defaultLeadDays: number[]
}) {
  const [alerts, setAlerts] = useState<number[]>(defaultLeadDays)

  const unused = LEAD_VALUES.filter((v) => !alerts.includes(v))

  function addAlert() {
    if (unused.length === 0) return
    setAlerts((prev) => [...prev, unused[0]])
  }

  function changeAlert(current: number, next: number) {
    setAlerts((prev) => prev.map((v) => (v === current ? next : v)))
  }

  function removeAlert(value: number) {
    setAlerts((prev) => prev.filter((v) => v !== value))
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Email alerts</span>

      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No alerts yet. Add one to email the recipients before each occurrence.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {alerts.map((value) => (
            <div key={value} className="flex items-center gap-2">
              <Select
                items={LEAD_ITEMS}
                value={String(value)}
                onValueChange={(v) =>
                  changeAlert(value, Number(typeof v === 'string' ? v : value))
                }
              >
                <SelectTrigger className="w-full sm:max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_LEAD_OPTIONS.filter(
                    (o) => o.value === value || !alerts.includes(o.value)
                  ).map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => removeAlert(value)}
                aria-label="Remove alert"
                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <RiCloseLine className="size-4" aria-hidden="true" />
              </button>
              {/* Submitted value */}
              <input type="hidden" name="reminderLeadDays" value={value} />
            </div>
          ))}
        </div>
      )}

      {unused.length > 0 ? (
        <button
          type="button"
          onClick={addAlert}
          className="inline-flex items-center gap-1 self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <RiAddLine className="size-4" aria-hidden="true" />
          Add alert
        </button>
      ) : null}
    </div>
  )
}
