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

// Parse a 'YYYY-MM-DD' anchor as a local date (midnight local), so calendar math
// does not drift across time zones the way `new Date('YYYY-MM-DD')` (UTC) would.
function localDateFromIso(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

// Enumerate every occurrence of a recurring series that falls within
// [rangeStart, rangeEnd] (inclusive), as local dates. Used by the calendar view
// to place a schedule on each day it is due in the visible month. The series is
// defined by its anchor date and cadence, independent of how far the live
// schedule has already advanced.
export function occurrencesInRange(
  anchorIso: string,
  frequency: RecurrenceFrequency,
  interval: number,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  const anchor = localDateFromIso(anchorIso)
  if (Number.isNaN(anchor.getTime())) return []

  const out: Date[] = []
  const step = interval >= 1 ? interval : 1

  if (frequency === 'one_time') {
    if (anchor >= rangeStart && anchor <= rangeEnd) out.push(anchor)
    return out
  }

  if (frequency === 'weekly') {
    const stepMs = 7 * step * 86_400_000
    let t = anchor.getTime()
    if (t < rangeStart.getTime()) {
      t += Math.ceil((rangeStart.getTime() - t) / stepMs) * stepMs
    }
    for (; t <= rangeEnd.getTime(); t += stepMs) {
      if (t >= rangeStart.getTime()) out.push(new Date(t))
    }
    return out
  }

  const monthsPerStep = (MONTHS_PER_STEP[frequency] ?? 12) * step
  const anchorMonthIndex = anchor.getFullYear() * 12 + anchor.getMonth()
  const startMonthIndex = rangeStart.getFullYear() * 12 + rangeStart.getMonth()
  let n =
    anchorMonthIndex < startMonthIndex
      ? Math.floor((startMonthIndex - anchorMonthIndex) / monthsPerStep)
      : 0

  // Bounded loop: the range is a single month grid, so only a handful of
  // iterations run; the cap is a safety net against bad input.
  for (let guard = 0; guard < 1000; guard += 1, n += 1) {
    const occMonthIndex = anchorMonthIndex + n * monthsPerStep
    const year = Math.floor(occMonthIndex / 12)
    const month = occMonthIndex % 12
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const occ = new Date(year, month, Math.min(anchor.getDate(), daysInMonth))
    if (occ > rangeEnd) break
    if (occ >= rangeStart) out.push(occ)
  }
  return out
}
