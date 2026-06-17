import type { RecurrenceFrequency } from '@/lib/schemas/work-order'

// Number of months each cadence advances per interval step. Weekly is handled
// separately because it advances in days, and one_time never repeats.
const MONTHS_PER_STEP: Partial<Record<RecurrenceFrequency, number>> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
}

// Given a first occurrence date, return the next occurrence's date as an ISO
// string, or null when the cadence does not repeat (one_time). The database
// generation function advances the schedule the same way for every later
// occurrence; this is used only to seed the template's second occurrence after
// the first one is filed inline.
export function nextOccurrenceAfter(
  anchorIso: string,
  frequency: RecurrenceFrequency,
  interval = 1
): string | null {
  if (frequency === 'one_time') return null

  const date = new Date(anchorIso)

  if (frequency === 'weekly') {
    date.setDate(date.getDate() + 7 * interval)
    return date.toISOString()
  }

  const months = MONTHS_PER_STEP[frequency]
  if (months === undefined) return null
  date.setMonth(date.getMonth() + months * interval)
  return date.toISOString()
}
